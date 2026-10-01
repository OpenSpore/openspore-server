// Relay/session store for the realtime lobby: a host opens a session code, one client joins,
// then frames are forwarded between the two peers (signaling for UDP hole punching, or full
// relay when direct P2P is impossible). Two players per session by design.

export type PeerRole = "host" | "client"

export interface RelayPeer {
  id: string
  name: string
  role: PeerRole
  send: (data: string | Uint8Array) => void
  endpoint?: { ip: string; port: number }
}

export interface RelaySession {
  code: string
  createdAt: number
  host: RelayPeer
  client?: RelayPeer
}

const sessions = new Map<string, RelaySession>()
const peerToCode = new Map<string, string>()

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"

const newCode = (): string => {
  for (;;) {
    let code = ""
    for (let i = 0; i < 6; i++) code += ALPHABET[Math.floor(Math.random() * ALPHABET.length)]
    if (!sessions.has(code)) return code
  }
}

export const relayStore = {
  create: (host: RelayPeer): RelaySession => {
    const session: RelaySession = { code: newCode(), createdAt: Date.now(), host }
    sessions.set(session.code, session)
    peerToCode.set(host.id, session.code)
    return session
  },
  join: (code: string, client: RelayPeer): RelaySession | "not_found" | "full" => {
    const session = sessions.get(code.toUpperCase())
    if (!session) return "not_found"
    if (session.client) return "full"
    session.client = client
    peerToCode.set(client.id, session.code)
    return session
  },
  get: (code: string) => sessions.get(code.toUpperCase()),
  sessionOf: (peerId: string) => {
    const code = peerToCode.get(peerId)
    return code ? sessions.get(code) : undefined
  },
  otherPeer: (peerId: string): RelayPeer | undefined => {
    const session = relayStore.sessionOf(peerId)
    if (!session) return undefined
    if (session.host.id === peerId) return session.client
    return session.client?.id === peerId ? session.host : undefined
  },
  // Removes the peer; the session dies when the host leaves or when nobody is left.
  leave: (peerId: string): { session?: RelaySession; closed: boolean; other?: RelayPeer } => {
    const session = relayStore.sessionOf(peerId)
    peerToCode.delete(peerId)
    if (!session) return { closed: false }
    if (session.host.id === peerId) {
      const other = session.client
      if (other) peerToCode.delete(other.id)
      sessions.delete(session.code)
      return { session, closed: true, other }
    }
    if (session.client?.id === peerId) {
      const other = session.host
      session.client = undefined
      return { session, closed: false, other }
    }
    return { closed: false }
  },
  count: () => sessions.size,
  clear: () => { sessions.clear(); peerToCode.clear() },
}
