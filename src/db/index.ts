import { Database } from "bun:sqlite"

const dbPath = process.env.DATABASE_PATH ?? "openspore.db"
export const db = new Database(dbPath, { create: true })

db.run(`
  CREATE TABLE IF NOT EXISTS empires (
    id TEXT PRIMARY KEY,
    player_id TEXT NOT NULL,
    name TEXT NOT NULL,
    home_world TEXT NOT NULL,
    color_r INTEGER NOT NULL,
    color_g INTEGER NOT NULL,
    color_b INTEGER NOT NULL,
    online INTEGER NOT NULL DEFAULT 1,
    last_seen INTEGER NOT NULL,
    token TEXT NOT NULL DEFAULT ''
  );

  CREATE TABLE IF NOT EXISTS diplomacy_offers (
    id TEXT PRIMARY KEY,
    from_id TEXT NOT NULL,
    to_id TEXT NOT NULL,
    type TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at INTEGER NOT NULL,
    FOREIGN KEY (from_id) REFERENCES empires(id),
    FOREIGN KEY (to_id) REFERENCES empires(id)
  );
`)

// Migration: add token column to existing databases
try {
  db.run("ALTER TABLE empires ADD COLUMN token TEXT NOT NULL DEFAULT ''")
} catch {
  // Column already exists — ignore
}

// Migration: enforce unique playerId
db.run("CREATE UNIQUE INDEX IF NOT EXISTS idx_empires_player_id ON empires(player_id)")
