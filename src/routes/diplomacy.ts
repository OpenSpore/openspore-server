import { Elysia, t } from "elysia"
import { randomUUIDv7 } from "bun"
import { diplomacyStore } from "../store/diplomacy"
import { empireStore } from "../store/empire"
import { broadcast } from "./events"
import { resolveToken } from "../auth"

export const diplomacyRoutes = new Elysia({ prefix: "/diplomacy" })
  .post(
    "/offer",
    ({ body, headers, status }) => {
      const from = empireStore.get(body.fromId)
      if (!from) return status(404, { message: "From empire not found" })

      const to = empireStore.get(body.toId)
      if (!to) return status(404, { message: "To empire not found" })

      const caller = resolveToken(headers.authorization)
      if (!caller) return status(401, { message: "Unauthorized" })
      if (caller.id !== body.fromId) return status(403, { message: "Forbidden" })

      const offer = {
        id: randomUUIDv7(),
        fromId: body.fromId,
        toId: body.toId,
        type: body.type,
        status: "pending" as const,
        createdAt: new Date(),
      }

      diplomacyStore.add(offer)
      broadcast("diplomacy:offer", offer)

      return { success: true, offer }
    },
    {
      body: t.Object({
        fromId: t.String(),
        toId: t.String(),
        type: t.Union([
          t.Literal("alliance"),
          t.Literal("war"),
          t.Literal("trade"),
        ]),
      }),
    }
  )
  .get("/offers/:empireId", ({ params }) => {
    return diplomacyStore.getIncoming(params.empireId)
  })
  .patch("/offer/:id/accept", ({ params, headers, status }) => {
    const caller = resolveToken(headers.authorization)
    if (!caller) return status(401, { message: "Unauthorized" })

    const offer = diplomacyStore.get(params.id)
    if (!offer) return status(404, { message: "Offer not found" })
    if (caller.id !== offer.toId) return status(403, { message: "Forbidden" })

    diplomacyStore.updateStatus(params.id, "accepted")
    broadcast("diplomacy:accepted", { offerId: params.id })
    return { success: true, status: "accepted" }
  })
  .patch("/offer/:id/reject", ({ params, headers, status }) => {
    const caller = resolveToken(headers.authorization)
    if (!caller) return status(401, { message: "Unauthorized" })

    const offer = diplomacyStore.get(params.id)
    if (!offer) return status(404, { message: "Offer not found" })
    if (caller.id !== offer.toId) return status(403, { message: "Forbidden" })

    diplomacyStore.updateStatus(params.id, "rejected")
    broadcast("diplomacy:rejected", { offerId: params.id })
    return { success: true, status: "rejected" }
  })
