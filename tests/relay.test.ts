import { afterAll, beforeEach, describe, expect, test } from "bun:test"
import { Elysia } from "elysia"
import { relayRoutes } from "../src/routes/relay"
import { relayStore } from "../src/store/relay"

const app = new Elysia().use(relayRoutes).listen(0)
const port = app.server!.port
const url = `ws://localhost:${port}/relay`

class Client {
  ws: WebSocket
  inbox: Array<Record<string, unknown> | Uint8Array> = []
  waiters: Array<() => void> = []
  constructor() {
    this.ws = new WebSocket(url)
    this.ws.binaryType = "arraybuffer"
    this.ws.onmessage = (ev) => {
      this.inbox.push(typeof ev.data === "string" ? JSON.parse(ev.data) : new Uint8Array(ev.data as ArrayBuffer))
      for (const w of this.waiters.splice(0)) w()
    }
  }
  open() { return new Promise<void>((res) => { if (this.ws.readyState === 1) res(); else this.ws.onopen = () => res() }) }
  send(m: Record<string, unknown>) { this.ws.send(JSON.stringify(m)) }
  async next(t?: string, timeoutMs = 2000): Promise<Record<string, unknown>> {
    const deadline = Date.now() + timeoutMs
    for (;;) {
      const i = this.inbox.findIndex((m) => !(m instanceof Uint8Array) && (!t || m.t === t))
      if (i >= 0) return this.inbox.splice(i, 1)[0] as Record<string, unknown>
      if (Date.now() > deadline) throw new Error(`timeout waiting for ${t}`)
      await new Promise<void>((res) => { this.waiters.push(res); setTimeout(res, 50) })
    }
  }
  async nextBinary(timeoutMs = 2000): Promise<Uint8Array> {
    const deadline = Date.now() + timeoutMs
    for (;;) {
      const i = this.inbox.findIndex((m) => m instanceof Uint8Array)
      if (i >= 0) return this.inbox.splice(i, 1)[0] as Uint8Array
      if (Date.now() > deadline) throw new Error("timeout waiting for binary")
      await new Promise<void>((res) => { this.waiters.push(res); setTimeout(res, 50) })
    }
  }
  close() { this.ws.close() }
}

const connect = async () => { const c = new Client(); await c.open(); await c.next("hello"); return c }

describe("relay", () => {
  beforeEach(() => relayStore.clear())
  afterAll(() => app.server?.stop(true))

  test("host gets a 6-char code and stats count it", async () => {
    const host = await connect()
    host.send({ t: "host", name: "alice" })
    const hosted = await host.next("hosted")
    expect(typeof hosted.code).toBe("string")
    expect((hosted.code as string).length).toBe(6)
    const stats = await (await fetch(`http://localhost:${port}/relay/stats`)).json()
    expect(stats.sessions).toBe(1)
    host.close()
  })

  test("client joins, both are notified, messages and endpoints are relayed", async () => {
    const host = await connect(); const client = await connect()
    host.send({ t: "host", name: "alice" })
    const code = (await host.next("hosted")).code as string
    client.send({ t: "join", code: code.toLowerCase(), name: "bob" })
    const joined = await client.next("joined")
    expect(joined.code).toBe(code)
    expect((joined.peer as { name: string }).name).toBe("alice")
    const peer = await host.next("peer")
    expect(peer.name).toBe("bob")

    client.send({ t: "endpoint", ip: "10.0.0.5", port: 7777 })
    const ep = await host.next("endpoint")
    expect(ep.ip).toBe("10.0.0.5"); expect(ep.port).toBe(7777); expect(ep.from).toBe("client")

    host.send({ t: "relay", data: { hello: 1 } })
    const r = await client.next("relay")
    expect(r.from).toBe("host"); expect((r.data as { hello: number }).hello).toBe(1)

    host.ws.send(new Uint8Array([1, 2, 3, 4]))
    const bin = await client.nextBinary()
    expect(Array.from(bin)).toEqual([1, 2, 3, 4])
    host.close(); client.close()
  })

  test("unknown code, full session and no-session errors", async () => {
    const host = await connect(); const c1 = await connect(); const c2 = await connect()
    c1.send({ t: "join", code: "ZZZZZZ", name: "x" })
    expect((await c1.next("error")).code).toBe("not_found")
    host.send({ t: "host", name: "alice" })
    const code = (await host.next("hosted")).code as string
    c1.send({ t: "join", code, name: "bob" }); await c1.next("joined")
    c2.send({ t: "join", code, name: "carol" })
    expect((await c2.next("error")).code).toBe("full")
    c2.send({ t: "relay", data: 1 })
    expect((await c2.next("error")).code).toBe("no_session")
    c2.send({ t: "nonsense" })
    expect((await c2.next("error")).code).toBe("bad_message")
    host.close(); c1.close(); c2.close()
  })

  test("host leaving closes the session, client leaving keeps it open", async () => {
    const host = await connect(); const client = await connect()
    host.send({ t: "host", name: "alice" })
    const code = (await host.next("hosted")).code as string
    client.send({ t: "join", code, name: "bob" }); await client.next("joined"); await host.next("peer")

    client.send({ t: "leave" }); await client.next("left")
    const left = await host.next("peer_left")
    expect(left.closed).toBe(false)
    expect(relayStore.count()).toBe(1)

    const client2 = await connect()
    client2.send({ t: "join", code, name: "dave" }); await client2.next("joined"); await host.next("peer")
    host.close()
    const gone = await client2.next("peer_left")
    expect(gone.closed).toBe(true)
    await new Promise((r) => setTimeout(r, 50))
    expect(relayStore.count()).toBe(0)
    client.close(); client2.close()
  })
})
