import { describe, it, expect, beforeEach } from "bun:test"
import { Elysia } from "elysia"
import { empireRoutes } from "../src/routes/empire"
import { empireStore } from "../src/store/empire"
import type { Empire } from "../src/types"

interface RegisterResponse {
  success: boolean
  empire: Empire
  token: string
}

const app = new Elysia().use(empireRoutes)

const validBody = {
  playerId: "player1",
  name: "Zorgons",
  homeWorld: "Zorg Prime",
  color: [255, 0, 0],
}

beforeEach(() => {
  empireStore.clear()
})

describe("POST /empire/register", () => {
  it("возвращает empire с id", async () => {
    const res = await app.handle(
      new Request("http://localhost/empire/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validBody),
      })
    )
    expect(res.status).toBe(200)
    const data = await res.json() as RegisterResponse
    expect(data.success).toBe(true)
    expect(data.empire.id).toBeString()
    expect(data.empire.name).toBe("Zorgons")
  })

  it("422 без обязательных полей", async () => {
    const res = await app.handle(
      new Request("http://localhost/empire/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId: "player1" }),
      })
    )
    expect(res.status).toBe(422)
  })

  it("422 с невалидным color", async () => {
    const res = await app.handle(
      new Request("http://localhost/empire/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...validBody, color: [255, 0] }),
      })
    )
    expect(res.status).toBe(422)
  })

  it("409 при повторном playerId", async () => {
    await app.handle(
      new Request("http://localhost/empire/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validBody),
      })
    )
    const res = await app.handle(
      new Request("http://localhost/empire/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validBody),
      })
    )
    expect(res.status).toBe(409)
  })
})

describe("GET /empire/:id", () => {
  it("200 для существующей империи", async () => {
    const reg = await app.handle(
      new Request("http://localhost/empire/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validBody),
      })
    )
    const { empire } = await reg.json() as RegisterResponse

    const res = await app.handle(
      new Request(`http://localhost/empire/${empire.id}`)
    )
    expect(res.status).toBe(200)
    const data = await res.json() as Empire
    expect(data.id).toBe(empire.id)
  })

  it("404 для несуществующей империи", async () => {
    const res = await app.handle(
      new Request("http://localhost/empire/nonexistent-id")
    )
    expect(res.status).toBe(404)
  })
})

describe("PATCH /empire/:id/heartbeat", () => {
  it("200 и lastSeen обновился", async () => {
    const reg = await app.handle(
      new Request("http://localhost/empire/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validBody),
      })
    )
    const { empire, token } = await reg.json() as RegisterResponse

    const before = Date.now()
    await Bun.sleep(10)

    const res = await app.handle(
      new Request(`http://localhost/empire/${empire.id}/heartbeat`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` },
      })
    )
    expect(res.status).toBe(200)

    const updated = empireStore.get(empire.id)
    expect(updated!.lastSeen.getTime()).toBeGreaterThanOrEqual(before)
  })

  it("404 для несуществующей империи", async () => {
    const res = await app.handle(
      new Request("http://localhost/empire/nonexistent-id/heartbeat", {
        method: "PATCH",
        headers: { Authorization: "Bearer invalid-token" },
      })
    )
    expect(res.status).toBe(404)
  })
})