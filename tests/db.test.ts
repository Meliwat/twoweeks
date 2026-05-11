import { test, expect, describe, beforeAll } from "bun:test";
import { rmSync, existsSync } from "node:fs";

// Set storage location BEFORE importing the db module (it touches disk at load).
const TEST_DIR = process.env.TWOWEEKS_HOME ?? `/tmp/twoweeks-test-${process.pid}`;
process.env.TWOWEEKS_HOME = TEST_DIR;

// Clean any stale fixture from previous runs.
if (existsSync(TEST_DIR)) {
  rmSync(TEST_DIR, { recursive: true, force: true });
}

const dbModule = await import("../src/db.ts");

describe("db: session lifecycle", () => {
  test("creates and reads an active session", () => {
    const s = dbModule.createSession("test task", "2 weeks", 1_209_600_000);
    expect(s.id).toBeGreaterThan(0);
    expect(s.task).toBe("test task");
    expect(s.eta_text).toBe("2 weeks");
    expect(s.shipped_at).toBeNull();
    expect(s.abandoned).toBe(0);
  });

  test("getMostRecentActive returns the latest", () => {
    const s = dbModule.getMostRecentActive();
    expect(s).not.toBeNull();
    expect(s?.task).toBe("test task");
  });

  test("ship updates shipped_at and excludes from active", () => {
    const active = dbModule.getMostRecentActive();
    expect(active).not.toBeNull();
    const shipped = dbModule.shipSession(active!.id);
    expect(shipped?.shipped_at).toBeGreaterThan(0);
    expect(dbModule.getMostRecentActive()).toBeNull();
  });

  test("getMostRecentShipped finds shipped session", () => {
    const s = dbModule.getMostRecentShipped();
    expect(s).not.toBeNull();
    expect(s?.task).toBe("test task");
  });

  test("abandon excludes from active and from stats", () => {
    const a = dbModule.createSession("abandon me", "1 day", 86_400_000);
    dbModule.abandonSession(a.id);
    expect(dbModule.getMostRecentActive()).toBeNull();
    const stats = dbModule.getStats();
    expect(stats.abandoned).toBe(1);
  });

  test("getAllShipped excludes abandoned", () => {
    const shipped = dbModule.getAllShipped();
    expect(shipped.length).toBe(1);
    expect(shipped[0].task).toBe("test task");
  });

  test("getStats reports totals", () => {
    const stats = dbModule.getStats();
    expect(stats.total).toBe(2);
    expect(stats.shipped).toBe(1);
    expect(stats.abandoned).toBe(1);
    expect(stats.totalSavedMs).toBeGreaterThan(0);
  });
});
