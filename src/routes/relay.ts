import { Elysia } from "elysia"
import { relayStore, type RelayPeer } from "../store/relay"

// WebSocket lobby + relay at /relay.
//
// Text frames are JSON messages:
//   -> { "t": "host", "name": "nsvk13" }                 => { "t": "hosted", "code": "AB12CD" }
//   -> { "t": "join", "code": "AB12CD", "name": "bob" }  => { "t": "joined", "code", "peer": {name} } ; host gets { "t": "peer", "name" }
//   -> { "t": "endpoint", "ip": "1.2.3.4", "port": 7777 } => forwarded to the other peer as-is plus "from"
//   -> { "t": "relay", "data": <any> }                    => other peer gets { "t": "relay", "from": role, "data" }
//   -> { "t": "leave" }                                   => other peer gets { "t": "peer_left" }
//   <- { "t": "error", "code": "not_found" | "full" | "no_session" | "bad_message" }
// Binary frames are forwarded verbatim to the other peer (future: C++ WebSocket transport).

type Msg = { t: string; [k: string]: unknown }

const parse = (raw: unknown): Msg | null => {
  if (typeof raw === "object" && raw !== null && "t" in raw) return raw as Msg
  if (typeof raw !== "string") return null
  try {
    const m = JSON.parse(raw)
    return typeof m === "object" && m && typeof m.t === "string" ? (m as Msg) : null
  } catch {
    return null
  }
}

export const relayRoutes = new Elysia()
  .ws("/relay", {
    open(ws) {
      ws.send(JSON.stringify({ t: "hello", protocol: 1 }))
    },
    message(ws, raw) {
      const send = (m: Msg) => ws.send(JSON.stringify(m))
      if (raw instanceof Uint8Array || raw instanceof ArrayBuffer) {
        const other = relayStore.otherPeer(ws.id)
        if (other) other.send(raw instanceof ArrayBuffer ? new Uint8Array(raw) : raw)
        return
      }
      const msg = parse(raw)
      if (!msg) return send({ t: "error", code: "bad_message" })

      const me = (): RelayPeer => ({
        id: ws.id,
        name: typeof msg.name === "string" ? msg.name.slice(0, 32) : "player",
        role: "host",
        send: (data) => ws.send(data),
      })

      switch (msg.t) {
        case "host": {
          if (relayStore.sessionOf(ws.id)) return send({ t: "error", code: "already_in_session" })
          const session = relayStore.create(me())
          return send({ t: "hosted", code: session.code })
        }
        case "join": {
          if (relayStore.sessionOf(ws.id)) return send({ t: "error", code: "already_in_session" })
          if (typeof msg.code !== "string") return send({ t: "error", code: "bad_message" })
          const peer = { ...me(), role: "client" as const }
          const result = relayStore.join(msg.code, peer)
          if (result === "not_found" || result === "full") return send({ t: "error", code: result })
          result.host.send(JSON.stringify({ t: "peer", name: peer.name }))
          return send({ t: "joined", code: result.code, peer: { name: result.host.name } })
        }
        case "endpoint": {
          const session = relayStore.sessionOf(ws.id)
          if (!session) return send({ t: "error", code: "no_session" })
          const ip = typeof msg.ip === "string" ? msg.ip : (ws.remoteAddress ?? "")
          const port = typeof msg.port === "number" ? msg.port : 0
          const self = session.host.id === ws.id ? session.host : session.client
          if (self) self.endpoint = { ip, port }
          const other = relayStore.otherPeer(ws.id)
          if (other) other.send(JSON.stringify({ t: "endpoint", from: self?.role, ip, port }))
          return
        }
        case "relay": {
          const other = relayStore.otherPeer(ws.id)
          if (!other) return send({ t: "error", code: "no_session" })
          const self = relayStore.sessionOf(ws.id)!
          other.send(JSON.stringify({ t: "relay", from: self.host.id === ws.id ? "host" : "client", data: msg.data }))
          return
        }
        case "leave": {
          const r = relayStore.leave(ws.id)
          r.other?.send(JSON.stringify({ t: "peer_left", closed: r.closed }))
          return send({ t: "left" })
        }
        case "ping":
          return send({ t: "pong", time: msg.time ?? Date.now() })
        default:
          return send({ t: "error", code: "bad_message" })
      }
    },
    close(ws) {
      const r = relayStore.leave(ws.id)
      r.other?.send(JSON.stringify({ t: "peer_left", closed: r.closed }))
    },
  })
  .get("/relay/stats", () => ({ sessions: relayStore.count() }))
