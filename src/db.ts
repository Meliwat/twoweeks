import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

// Resolve storage path on every call (rather than at module load) so test
// suites that swap TWOWEEKS_HOME mid-process get isolation.
function dbPath(): string {
  const dir = process.env.TWOWEEKS_HOME ?? join(homedir(), ".twoweeks");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return join(dir, "history.json");
}

export interface Session {
  id: number;
  task: string;
  eta_text: string;
  eta_ms: number;
  started_at: number;
  shipped_at: number | null;
  abandoned: number;
  /** Verbatim AI quote (optional). Captured for future card rendering + share text. */
  quote?: string;
}

interface Store {
  version: 1;
  next_id: number;
  sessions: Session[];
}

function load(): Store {
  const path = dbPath();
  if (!existsSync(path)) {
    return { version: 1, next_id: 1, sessions: [] };
  }
  try {
    const raw = readFileSync(path, "utf-8");
    const parsed = JSON.parse(raw) as Store;
    if (!parsed.sessions || typeof parsed.next_id !== "number") {
      return { version: 1, next_id: 1, sessions: [] };
    }
    return parsed;
  } catch {
    return { version: 1, next_id: 1, sessions: [] };
  }
}

function save(store: Store): void {
  writeFileSync(dbPath(), JSON.stringify(store, null, 2));
}

export function createSession(
  task: string,
  etaText: string,
  etaMs: number,
  quote?: string
): Session {
  const store = load();
  const session: Session = {
    id: store.next_id,
    task,
    eta_text: etaText,
    eta_ms: etaMs,
    started_at: Date.now(),
    shipped_at: null,
    abandoned: 0,
    ...(quote ? { quote } : {}),
  };
  store.sessions.push(session);
  store.next_id++;
  save(store);
  return session;
}

export function getActiveSessions(): Session[] {
  const { sessions } = load();
  return sessions
    .filter((s) => s.shipped_at === null && s.abandoned === 0)
    .sort((a, b) => b.started_at - a.started_at);
}

export function getMostRecentActive(): Session | null {
  return getActiveSessions()[0] ?? null;
}

export function getSessionById(id: number): Session | null {
  const { sessions } = load();
  return sessions.find((s) => s.id === id) ?? null;
}

export function shipSession(id: number): Session | null {
  const store = load();
  const session = store.sessions.find((s) => s.id === id);
  if (!session || session.shipped_at !== null || session.abandoned === 1) {
    return session ?? null;
  }
  session.shipped_at = Date.now();
  save(store);
  return session;
}

export function abandonSession(id: number): Session | null {
  const store = load();
  const session = store.sessions.find((s) => s.id === id);
  if (!session) return null;
  session.abandoned = 1;
  save(store);
  return session;
}

export function getMostRecentShipped(): Session | null {
  return getAllShipped()[0] ?? null;
}

export function getAllShipped(): Session[] {
  const { sessions } = load();
  return sessions
    .filter((s) => s.shipped_at !== null && s.abandoned === 0)
    .sort((a, b) => (b.shipped_at as number) - (a.shipped_at as number));
}

export interface DbStats {
  total: number;
  shipped: number;
  abandoned: number;
  totalSavedMs: number;
}

export function getStats(): DbStats {
  const { sessions } = load();
  const shipped = sessions.filter((s) => s.shipped_at !== null && s.abandoned === 0);
  const abandoned = sessions.filter((s) => s.abandoned === 1);
  let totalSavedMs = 0;
  for (const s of shipped) {
    const actual = (s.shipped_at as number) - s.started_at;
    if (actual < s.eta_ms) totalSavedMs += s.eta_ms - actual;
  }
  return {
    total: sessions.length,
    shipped: shipped.length,
    abandoned: abandoned.length,
    totalSavedMs,
  };
}
