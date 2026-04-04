import { db } from "../db"
import type { DiplomacyOffer } from "../types"

const toOffer = (row: Record<string, unknown>): DiplomacyOffer => ({
  id: row.id as string,
  fromId: row.from_id as string,
  toId: row.to_id as string,
  type: row.type as DiplomacyOffer["type"],
  status: row.status as DiplomacyOffer["status"],
  createdAt: new Date(row.created_at as string),
})

export const diplomacyStore = {
  add: (offer: DiplomacyOffer) => {
    db.run(
      `INSERT INTO diplomacy_offers (id, from_id, to_id, type, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [offer.id, offer.fromId, offer.toId, offer.type, offer.status, offer.createdAt.toISOString()]
    )
  },
  get: (id: string) => {
    const row = db.query("SELECT * FROM diplomacy_offers WHERE id = ?").get(id) as Record<string, unknown> | null
    return row ? toOffer(row) : undefined
  },
  getIncoming: (empireId: string) => {
    const rows = db.query("SELECT * FROM diplomacy_offers WHERE to_id = ?").all(empireId) as Record<string, unknown>[]
    return rows.map(toOffer)
  },
  updateStatus: (id: string, status: DiplomacyOffer["status"]) => {
    const result = db.run(
      "UPDATE diplomacy_offers SET status = ? WHERE id = ?",
      [status, id]
    )
    return result.changes > 0
  },
  clear: () => db.run("DELETE FROM diplomacy_offers"),
};