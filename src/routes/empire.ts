import { Elysia, t } from "elysia";
import { empireStore } from "../store/empire";
import { randomUUIDv7 } from "bun";
import { broadcast } from "./events";
import { resolveToken } from "../auth";

export const empireRoutes = new Elysia({ prefix: "/empire" })
  .post(
    "/register",
    ({ body, status }) => {
      if (empireStore.getByPlayerId(body.playerId)) {
        return status(409, { message: "Player already has an empire" })
      }
      const empire = {
        id: randomUUIDv7(),
        playerId: body.playerId,
        name: body.name,
        homeWorld: body.homeWorld,
        color: body.color,
        online: true,
        lastSeen: new Date(),
      }
      const token = crypto.randomUUID()
      empireStore.register(empire, token)
      broadcast("empire:joined", empire)
      return { success: true, empire, token }
    },
    {
      body: t.Object({
        playerId: t.String(),
        name: t.String(),
        homeWorld: t.String(),
        color: t.Tuple([t.Number(), t.Number(), t.Number()]),
      }),
    }
  )
  .get("/:id", ({ params, status }) => {
    const empire = empireStore.get(params.id)
    if (!empire) return status(404, { message: "Empire not found" })
    return empire
  })
  .patch(
    "/:id/heartbeat",
    ({ params, headers, status }) => {
      const empire = empireStore.get(params.id)
      if (!empire) return status(404, { message: "Empire not found" })

      const caller = resolveToken(headers.authorization)
      if (!caller) return status(401, { message: "Unauthorized" })
      if (caller.id !== empire.id) return status(403, { message: "Forbidden" })

      empireStore.heartbeat(params.id)
      return { success: true }
    }
  )
