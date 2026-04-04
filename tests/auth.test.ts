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

const register = async (playerId: string, name: string): Promise<RegisterResponse> => {
  const res = await app.handle(
    new Request("http://localhost/empire/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ playerId, name, homeWorld: "World", color: [0, 0, 255] }),
    })
  )
  return res.json() as Promise<RegisterResponse>
}

const createOffer = async (fromId: string, toId: string, token: string) => {
  const res = await app.handle(
    new Request("http://localhost/diplomacy/offer", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ fromId, toId, type: "alliance" }),
    })
  )
  return res.json() as Promise<{ offer: { id: string } }>
}

beforeEach(() => {
  empireStore.clear()
  diplomacyStore.clear()
})

describe("POST /empire/register > token", () => {
  it("ответ содержит token", async () => {
    const data = await register("p1", "Zorgons")
    expect(data.token).toBeString()
    expect(data.token.length).toBeGreaterThan(0)
  })
})

describe("PATCH /empire/:id/heartbeat > аутентификация", () => {
  it("401 без Authorization заголовка", async () => {
    const { empire } = await register("p1", "Zorgons")
    const res = await app.handle(
      new Request(`http://localhost/empire/${empire.id}/heartbeat`, { method: "PATCH" })
    )
    expect(res.status).toBe(401)
  })

  it("401 с невалидным токеном", async () => {
    const { empire } = await register("p1", "Zorgons")
    const res = await app.handle(
      new Request(`http://localhost/empire/${empire.id}/heartbeat`, {
        method: "PATCH",
        headers: { Authorization: "Bearer invalid-token-xxx" },
      })
    )
    expect(res.status).toBe(401)
  })

  it("403 с токеном другой империи", async () => {
    const { empire: a } = await register("p1", "Zorgons")
    const { token: tokenB } = await register("p2", "Krakons")
    const res = await app.handle(
      new Request(`http://localhost/empire/${a.id}/heartbeat`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${tokenB}` },
      })
    )
    expect(res.status).toBe(403)
  })

  it("200 с корректным токеном", async () => {
    const { empire, token } = await register("p1", "Zorgons")
    const res = await app.handle(
      new Request(`http://localhost/empire/${empire.id}/heartbeat`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` },
      })
    )
    expect(res.status).toBe(200)
  })
})

describe("POST /diplomacy/offer > аутентификация", () => {
  it("401 без токена", async () => {
    const { empire: a } = await register("p1", "Zorgons")
    const { empire: b } = await register("p2", "Krakons")
    const res = await app.handle(
      new Request("http://localhost/diplomacy/offer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fromId: a.id, toId: b.id, type: "alliance" }),
      })
    )
    expect(res.status).toBe(401)
  })

  it("403 если токен не совпадает с fromId", async () => {
    const { empire: a } = await register("p1", "Zorgons")
    const { empire: b, token: tokenB } = await register("p2", "Krakons")
    const res = await app.handle(
      new Request("http://localhost/diplomacy/offer", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${tokenB}`,
        },
        body: JSON.stringify({ fromId: a.id, toId: b.id, type: "alliance" }),
      })
    )
    expect(res.status).toBe(403)
  })

  it("200 с корректным токеном fromId", async () => {
    const { empire: a, token: tokenA } = await register("p1", "Zorgons")
    const { empire: b } = await register("p2", "Krakons")
    const res = await app.handle(
      new Request("http://localhost/diplomacy/offer", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${tokenA}`,
        },
        body: JSON.stringify({ fromId: a.id, toId: b.id, type: "alliance" }),
      })
    )
    expect(res.status).toBe(200)
  })
})

describe("PATCH /diplomacy/offer/:id/accept > аутентификация", () => {
  it("401 без токена", async () => {
    const { empire: a, token: tokenA } = await register("p1", "Zorgons")
    const { empire: b } = await register("p2", "Krakons")
    const { offer } = await createOffer(a.id, b.id, tokenA)

    const res = await app.handle(
      new Request(`http://localhost/diplomacy/offer/${offer.id}/accept`, { method: "PATCH" })
    )
    expect(res.status).toBe(401)
  })

  it("403 если токен не совпадает с toId (передан токен fromId)", async () => {
    const { empire: a, token: tokenA } = await register("p1", "Zorgons")
    const { empire: b } = await register("p2", "Krakons")
    const { offer } = await createOffer(a.id, b.id, tokenA)

    const res = await app.handle(
      new Request(`http://localhost/diplomacy/offer/${offer.id}/accept`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${tokenA}` },
      })
    )
    expect(res.status).toBe(403)
  })

  it("200 с токеном toId", async () => {
    const { empire: a, token: tokenA } = await register("p1", "Zorgons")
    const { empire: b, token: tokenB } = await register("p2", "Krakons")
    const { offer } = await createOffer(a.id, b.id, tokenA)

    const res = await app.handle(
      new Request(`http://localhost/diplomacy/offer/${offer.id}/accept`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${tokenB}` },
      })
    )
    expect(res.status).toBe(200)
  })
})

describe("PATCH /diplomacy/offer/:id/reject > аутентификация", () => {
  it("401 без токена", async () => {
    const { empire: a, token: tokenA } = await register("p1", "Zorgons")
    const { empire: b } = await register("p2", "Krakons")
    const { offer } = await createOffer(a.id, b.id, tokenA)

    const res = await app.handle(
      new Request(`http://localhost/diplomacy/offer/${offer.id}/reject`, { method: "PATCH" })
    )
    expect(res.status).toBe(401)
  })

  it("403 если токен не совпадает с toId (передан токен fromId)", async () => {
    const { empire: a, token: tokenA } = await register("p1", "Zorgons")
    const { empire: b } = await register("p2", "Krakons")
    const { offer } = await createOffer(a.id, b.id, tokenA)

    const res = await app.handle(
      new Request(`http://localhost/diplomacy/offer/${offer.id}/reject`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${tokenA}` },
      })
    )
    expect(res.status).toBe(403)
  })

  it("200 с токеном toId", async () => {
    const { empire: a, token: tokenA } = await register("p1", "Zorgons")
    const { empire: b, token: tokenB } = await register("p2", "Krakons")
    const { offer } = await createOffer(a.id, b.id, tokenA)

    const res = await app.handle(
      new Request(`http://localhost/diplomacy/offer/${offer.id}/reject`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${tokenB}` },
      })
    )
    expect(res.status).toBe(200)
  })
})
