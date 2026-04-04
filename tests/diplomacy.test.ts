import { describe, it, expect, beforeEach } from "bun:test"
import { Elysia } from "elysia"
import { empireRoutes } from "../src/routes/empire"
import { diplomacyRoutes } from "../src/routes/diplomacy"
import { empireStore } from "../src/store/empire"
import { diplomacyStore } from "../src/store/diplomacy"
import type { Empire } from "../src/types"

interface RegisterResponse {
  success: boolean
  empire: Empire
  token: string
}

const app = new Elysia().use(empireRoutes).use(diplomacyRoutes)

const makeEmpire = async (playerId: string, name: string) => {
  const res = await app.handle(
    new Request("http://localhost/empire/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        playerId,
        name,
        homeWorld: "Some World",
        color: [255, 0, 0],
      }),
    })
  )
  const { empire, token } = await res.json() as RegisterResponse
  return { empire, token }
}

const makeOffer = async (fromId: string, toId: string, token: string, type = "alliance") =>
  app.handle(
    new Request("http://localhost/diplomacy/offer", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ fromId, toId, type }),
    })
  )

beforeEach(() => {
  empireStore.clear()
  diplomacyStore.clear()
})

describe("POST /diplomacy/offer", () => {
  it("создаёт оффер между двумя империями", async () => {
    const { empire: a, token: tokenA } = await makeEmpire("p1", "Zorgons")
    const { empire: b } = await makeEmpire("p2", "Krakons")

    const res = await makeOffer(a.id, b.id, tokenA)
    expect(res.status).toBe(200)
    const data = await res.json() as { success: boolean; offer: { id: string } }
    expect(data.success).toBe(true)
    expect(data.offer.id).toBeString()
  })

  it("422 без обязательных полей", async () => {
    const res = await app.handle(
      new Request("http://localhost/diplomacy/offer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fromId: "x" }),
      })
    )
    expect(res.status).toBe(422)
  })

  it("422 с невалидным type", async () => {
    const { empire: a, token: tokenA } = await makeEmpire("p1", "Zorgons")
    const { empire: b } = await makeEmpire("p2", "Krakons")

    const res = await app.handle(
      new Request("http://localhost/diplomacy/offer", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokenA}` },
        body: JSON.stringify({ fromId: a.id, toId: b.id, type: "invalid_type" }),
      })
    )
    expect(res.status).toBe(422)
  })

  it("404 если fromId не существует", async () => {
    const { empire: b, token: tokenB } = await makeEmpire("p2", "Krakons")

    const res = await app.handle(
      new Request("http://localhost/diplomacy/offer", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokenB}` },
        body: JSON.stringify({ fromId: "nonexistent", toId: b.id, type: "alliance" }),
      })
    )
    expect(res.status).toBe(404)
  })

  it("404 если toId не существует", async () => {
    const { empire: a, token: tokenA } = await makeEmpire("p1", "Zorgons")

    const res = await app.handle(
      new Request("http://localhost/diplomacy/offer", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokenA}` },
        body: JSON.stringify({ fromId: a.id, toId: "nonexistent", type: "alliance" }),
      })
    )
    expect(res.status).toBe(404)
  })
})

describe("GET /diplomacy/offers/:empireId", () => {
  it("возвращает входящие офферы", async () => {
    const { empire: a, token: tokenA } = await makeEmpire("p1", "Zorgons")
    const { empire: b } = await makeEmpire("p2", "Krakons")

    await makeOffer(a.id, b.id, tokenA)

    const res = await app.handle(
      new Request(`http://localhost/diplomacy/offers/${b.id}`)
    )
    expect(res.status).toBe(200)
    const data = await res.json() as unknown[]
    expect(data).toHaveLength(1)
  })

  it("пустой список если офферов нет", async () => {
    const { empire: a } = await makeEmpire("p1", "Zorgons")
    const res = await app.handle(
      new Request(`http://localhost/diplomacy/offers/${a.id}`)
    )
    expect(res.status).toBe(200)
    const data = await res.json() as unknown[]
    expect(data).toEqual([])
  })
})

describe("PATCH /diplomacy/offer/:id/accept", () => {
  it("принимает оффер", async () => {
    const { empire: a, token: tokenA } = await makeEmpire("p1", "Zorgons")
    const { empire: b, token: tokenB } = await makeEmpire("p2", "Krakons")

    const offerRes = await makeOffer(a.id, b.id, tokenA)
    const { offer } = await offerRes.json() as { offer: { id: string } }

    const res = await app.handle(
      new Request(`http://localhost/diplomacy/offer/${offer.id}/accept`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${tokenB}` },
      })
    )
    expect(res.status).toBe(200)
    const data = await res.json() as { success: boolean; status: string }
    expect(data.success).toBe(true)
    expect(data.status).toBe("accepted")
  })

  it("404 для несуществующего оффера", async () => {
    const { token } = await makeEmpire("p1", "Zorgons")
    const res = await app.handle(
      new Request("http://localhost/diplomacy/offer/nonexistent/accept", {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` },
      })
    )
    expect(res.status).toBe(404)
  })
})

describe("PATCH /diplomacy/offer/:id/reject", () => {
  it("отклоняет оффер", async () => {
    const { empire: a, token: tokenA } = await makeEmpire("p1", "Zorgons")
    const { empire: b, token: tokenB } = await makeEmpire("p2", "Krakons")

    const offerRes = await makeOffer(a.id, b.id, tokenA, "war")
    const { offer } = await offerRes.json() as { offer: { id: string } }

    const res = await app.handle(
      new Request(`http://localhost/diplomacy/offer/${offer.id}/reject`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${tokenB}` },
      })
    )
    expect(res.status).toBe(200)
    const data = await res.json() as { success: boolean; status: string }
    expect(data.success).toBe(true)
    expect(data.status).toBe("rejected")
  })

  it("404 для несуществующего оффера", async () => {
    const { token } = await makeEmpire("p1", "Zorgons")
    const res = await app.handle(
      new Request("http://localhost/diplomacy/offer/nonexistent/reject", {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` },
      })
    )
    expect(res.status).toBe(404)
  })
})
