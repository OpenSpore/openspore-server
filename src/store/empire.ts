import { db } from "../db"
import type { Empire } from "../types"

const toEmpire = (row: Record<string, unknown>): Empire => ({
  id: row.id as string,
  playerId: row.player_id as string,
  name: row.name as string,
  homeWorld: row.home_world as string,
  color: [row.color_r as number, row.color_g as number, row.color_b as number],
  online: row.online === 1,
  lastSeen: new Date(row.last_seen as number),
})

export const empireStore = {
  register: (empire: Empire, token: string) => {
    db.run(
      `INSERT INTO empires (id, player_id, name, home_world, color_r, color_g, color_b, online, last_seen, token)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        empire.id,
        empire.playerId,
        empire.name,
        empire.homeWorld,
        empire.color[0],
        empire.color[1],
        empire.color[2],
        empire.online ? 1 : 0,
        empire.lastSeen.getTime(),
        token,
      ]
    )
  },
  getAll: (opts?: { page: number; limit: number }) => {
    if (opts) {
      const offset = (opts.page - 1) * opts.limit
      const rows = db.query("SELECT * FROM empires LIMIT ? OFFSET ?").all(opts.limit, offset) as Record<string, unknown>[]
      return rows.map(toEmpire)
    }
    const rows = db.query("SELECT * FROM empires").all() as Record<string, unknown>[]
    return rows.map(toEmpire)
  },
  count: () => {
    const row = db.query("SELECT COUNT(*) as n FROM empires").get() as { n: number }
    return row.n
  },
  get: (id: string) => {
    const row = db.query("SELECT * FROM empires WHERE id = ?").get(id) as Record<string, unknown> | null
    return row ? toEmpire(row) : undefined
  },
  getByPlayerId: (playerId: string) => {
    const row = db.query("SELECT * FROM empires WHERE player_id = ?").get(playerId) as Record<string, unknown> | null
    return row ? toEmpire(row) : undefined
  },
  getByToken: (token: string) => {
    const row = db.query("SELECT * FROM empires WHERE token = ?").get(token) as Record<string, unknown> | null
    return row ? toEmpire(row) : undefined
  },
  heartbeat: (id: string) => {
    const result = db.run(
      "UPDATE empires SET online = 1, last_seen = ? WHERE id = ?",
      [Date.now(), id]
    )
    return result.changes > 0
  },
  setOffline: (id: string) => {
    db.run("UPDATE empires SET online = 0 WHERE id = ?", [id])
  },
  clear: () => db.run("DELETE FROM empires"),
}

setInterval(() => {
  const cutoff = Date.now() - 60_000
  db.run("UPDATE empires SET online = 0 WHERE online = 1 AND last_seen < ?", [cutoff])
}, 30_000)
