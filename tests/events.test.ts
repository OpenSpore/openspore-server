import { describe, it, expect } from "bun:test"
import { Elysia } from "elysia"
import { eventsRoutes, broadcast } from "../src/routes/events"

const app = new Elysia().use(eventsRoutes)

describe("GET /events/stream", () => {
  it("Content-Type: text/event-stream", async () => {
    const res = await app.handle(
      new Request("http://localhost/events/stream")
    )
    expect(res.headers.get("content-type")).toContain("text/event-stream")
  })

  it("первый chunk — connected", async () => {
    const res = await app.handle(
      new Request("http://localhost/events/stream")
    )
    const reader = res.body!.getReader()
    const { value } = await reader.read()
    const text = typeof value === "string" ? value : new TextDecoder().decode(value as Uint8Array)
    expect(text).toContain(": connected")
    reader.cancel()
  })
})

describe("broadcast()", () => {
  it("не падает если нет клиентов", () => {
    expect(() => broadcast("test:event", { foo: "bar" })).not.toThrow()
  })

  it("отправляет событие подключённому клиенту", async () => {
    const res = await app.handle(
      new Request("http://localhost/events/stream")
    )
    const reader = res.body!.getReader()

    await reader.read()

    broadcast("empire:joined", { name: "Zorgons" })

    const { value } = await reader.read()
    const text = typeof value === "string" ? value : new TextDecoder().decode(value as Uint8Array)

    expect(text).toContain("event: empire:joined")
    expect(text).toContain("Zorgons")

    reader.cancel()
  })
});