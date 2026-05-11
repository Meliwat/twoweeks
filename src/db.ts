import { Database } from "bun:sqlite";
import { mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

const DB_DIR = join(homedir(), ".twoweeks");
const DB_PATH = join(DB_DIR, "history.db");

if (!existsSync(DB_DIR)) {
  mkdirSync(DB_DIR, { recursive: true });
}

const db = new Database(DB_PATH);

db.exec(`
  CREATE TABLE IF NOT EXISTS sessions (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    task        TEXT NOT NULL,
    eta_text    TEXT NOT NULL DEFAULT '2 weeks',
    eta_ms      INTEGER NOT NULL DEFAULT 1209600000,
    started_at  INTEGER NOT NULL,
    shipped_at  INTEGER,
    abandoned   INTEGER NOT NULL DEFAULT 0
  );
`);

export interface Session {
  id: number;
  task: string;
  eta_text: string;
  eta_ms: number;
  started_at: number;
  shipped_at: number | null;
  abandoned: number;
}

export function createSession(task: string, etaText: string, etaMs: number): Session {
  const result = db
    .query(
      "INSERT INTO sessions (task, eta_text, eta_ms, started_at) VALUES (?, ?, ?, ?)"
    )
    .run(task, etaText, etaMs, Date.now());
  const session = getSessionById(Number(result.lastInsertRowid));
  if (!session) throw new Error("Failed to create session");
  return session;
}

export function getActiveSessions(): Session[] {
  return db
    .query(
      "SELECT * FROM sessions WHERE shipped_at IS NULL AND abandoned = 0 ORDER BY started_at DESC"
    )
    .all() as Session[];
}

export function getMostRecentActive(): Session | null {
  return (db
    .query(
      "SELECT * FROM sessions WHERE shipped_at IS NULL AND abandoned = 0 ORDER BY started_at DESC LIMIT 1"
    )
    .get() as Session | null) ?? null;
}

export function getSessionById(id: number): Session | null {
  return (db
    .query("SELECT * FROM sessions WHERE id = ?")
    .get(id) as Session | null) ?? null;
}

export function shipSession(id: number): Session | null {
  db.query(
    "UPDATE sessions SET shipped_at = ? WHERE id = ? AND shipped_at IS NULL AND abandoned = 0"
  ).run(Date.now(), id);
  return getSessionById(id);
}

export function abandonSession(id: number): Session | null {
  db.query("UPDATE sessions SET abandoned = 1 WHERE id = ?").run(id);
  return getSessionById(id);
}

export function getMostRecentShipped(): Session | null {
  return (db
    .query(
      "SELECT * FROM sessions WHERE shipped_at IS NOT NULL AND abandoned = 0 ORDER BY shipped_at DESC LIMIT 1"
    )
    .get() as Session | null) ?? null;
}
