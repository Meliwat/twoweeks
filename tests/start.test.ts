import { test, expect, describe, beforeAll, beforeEach } from "bun:test";
import { rmSync, existsSync } from "node:fs";

// Set storage location BEFORE importing the db module.
const TEST_DIR = `/tmp/twoweeks-start-test-${process.pid}`;
process.env.TWOWEEKS_HOME = TEST_DIR;

if (existsSync(TEST_DIR)) {
  rmSync(TEST_DIR, { recursive: true, force: true });
}

const { start } = await import("../src/commands/start.ts");

describe("start command requires AI estimate", () => {
  beforeEach(() => {
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true, force: true });
    }
  });

  test("rejects empty task", () => {
    const code = start({ task: "", json: true });
    expect(code).toBe(1);
  });

  test("rejects missing ETA (no auto-default to 2 weeks)", () => {
    const code = start({ task: "build the auth flow", json: true });
    expect(code).toBe(1);
  });

  test("accepts explicit ETA", () => {
    const code = start({ task: "build the auth flow", eta: "3 months", json: true });
    expect(code).toBe(0);
  });

  test("rejects unparseable ETA", () => {
    const code = start({ task: "build the auth flow", eta: "fortnight", json: true });
    expect(code).toBe(1);
  });
});
