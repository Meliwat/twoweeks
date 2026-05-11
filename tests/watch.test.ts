import { test, expect, describe, beforeEach } from "bun:test";
import { writeFileSync, mkdirSync, rmSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const TEST_DIR = `/tmp/twoweeks-watch-test-${process.pid}`;
process.env.TWOWEEKS_HOME = TEST_DIR;

if (existsSync(TEST_DIR)) {
  rmSync(TEST_DIR, { recursive: true, force: true });
}

const { watch } = await import("../src/commands/watch.ts");
const { installHook } = await import("../src/commands/install-hook.ts");
const { getMostRecentActive } = await import("../src/db.ts");

function resetDb(): void {
  if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true, force: true });
  mkdirSync(TEST_DIR, { recursive: true });
}

function writeTranscript(name: string, lines: object[]): string {
  const path = join(TEST_DIR, name);
  writeFileSync(path, lines.map((l) => JSON.stringify(l)).join("\n"));
  return path;
}

describe("watch command", () => {
  beforeEach(() => resetDb());

  test("creates a session from a transcript with an estimate", async () => {
    const transcript = writeTranscript("t1.jsonl", [
      { type: "user", message: { content: "Can you build the auth flow?" } },
      {
        type: "assistant",
        message: { content: [{ type: "text", text: "Sure — about 2 weeks of focused work." }] },
      },
    ]);
    const code = await watch({ fromPath: transcript, quiet: true });
    expect(code).toBe(0);

    const active = getMostRecentActive();
    expect(active).not.toBeNull();
    expect(active!.task).toContain("build the auth flow");
    expect(active!.eta_text).toBe("2 weeks");
    expect(active!.quote).toContain("2 weeks");
  });

  test("captures the largest estimate when several are present", async () => {
    const transcript = writeTranscript("t2.jsonl", [
      { type: "user", message: { content: "Refactor the parser" } },
      {
        type: "assistant",
        message: {
          content: [
            {
              type: "text",
              text: "Phase 1 takes a day. Weeks 2-6 are the heavy lift. Then 1 week of polish.",
            },
          ],
        },
      },
    ]);
    const code = await watch({ fromPath: transcript, quiet: true });
    expect(code).toBe(0);
    const active = getMostRecentActive();
    expect(active!.eta_text).toBe("6 weeks");
  });

  test("no estimate → no session created, exit clean in quiet mode", async () => {
    const transcript = writeTranscript("t3.jsonl", [
      { type: "user", message: { content: "Just analyze the code" } },
      {
        type: "assistant",
        message: { content: [{ type: "text", text: "Looks good. No major issues." }] },
      },
    ]);
    const code = await watch({ fromPath: transcript, quiet: true });
    expect(code).toBe(0);
    expect(getMostRecentActive()).toBeNull();
  });

  test("active session exists → does not create a second", async () => {
    const transcript = writeTranscript("t4.jsonl", [
      { type: "user", message: { content: "Build the dashboard" } },
      { type: "assistant", message: { content: [{ type: "text", text: "About 3 weeks." }] } },
    ]);
    const first = await watch({ fromPath: transcript, quiet: true });
    expect(first).toBe(0);
    expect(getMostRecentActive()).not.toBeNull();
    const firstTask = getMostRecentActive()!.task;

    // Second invocation with a different estimate — should be a no-op.
    const transcript2 = writeTranscript("t5.jsonl", [
      { type: "user", message: { content: "Now also do search" } },
      { type: "assistant", message: { content: [{ type: "text", text: "Another 4 days." }] } },
    ]);
    const second = await watch({ fromPath: transcript2, quiet: true });
    expect(second).toBe(0);
    // Still the first session — first-write-wins.
    expect(getMostRecentActive()!.task).toBe(firstTask);
  });

  test("JSON mode emits structured output", async () => {
    const transcript = writeTranscript("t6.jsonl", [
      { type: "user", message: { content: "Migrate the DB" } },
      { type: "assistant", message: { content: [{ type: "text", text: "Takes 5 hours." }] } },
    ]);
    const original = console.log;
    let logged = "";
    console.log = (msg: string) => {
      logged += msg + "\n";
    };
    try {
      const code = await watch({ fromPath: transcript, json: true });
      expect(code).toBe(0);
      const parsed = JSON.parse(logged.trim());
      expect(parsed.ok).toBe(true);
      expect(parsed.session.eta_text).toBe("5 hours");
    } finally {
      console.log = original;
    }
  });
});

describe("install-hook command", () => {
  const HOOK_TEST_DIR = `/tmp/twoweeks-hook-test-${process.pid}`;
  const settingsPath = join(HOOK_TEST_DIR, ".claude", "settings.json");

  beforeEach(() => {
    if (existsSync(HOOK_TEST_DIR)) rmSync(HOOK_TEST_DIR, { recursive: true, force: true });
    mkdirSync(HOOK_TEST_DIR, { recursive: true });
    process.chdir(HOOK_TEST_DIR);
  });

  test("install creates the hook entry", () => {
    const code = installHook({ scope: "project", json: true });
    expect(code).toBe(0);
    expect(existsSync(settingsPath)).toBe(true);
    const settings = JSON.parse(readFileSync(settingsPath, "utf-8"));
    expect(settings.hooks.Stop.length).toBe(1);
    expect(settings.hooks.Stop[0].hooks[0].command).toContain("twoweeks");
    expect(settings.hooks.Stop[0].hooks[0]._twoweeks).toBe("twoweeks-auto-capture");
  });

  test("install is idempotent — second call doesn't double up", () => {
    installHook({ scope: "project", json: true });
    installHook({ scope: "project", json: true });
    const settings = JSON.parse(readFileSync(settingsPath, "utf-8"));
    expect(settings.hooks.Stop.length).toBe(1);
  });

  test("uninstall removes the entry", () => {
    installHook({ scope: "project", json: true });
    expect(existsSync(settingsPath)).toBe(true);

    const code = installHook({ uninstall: true, scope: "project", json: true });
    expect(code).toBe(0);
    const settings = JSON.parse(readFileSync(settingsPath, "utf-8"));
    expect(settings.hooks?.Stop).toBeUndefined();
  });

  test("uninstall preserves unrelated hooks", () => {
    // Pre-existing user hook unrelated to twoweeks.
    mkdirSync(join(HOOK_TEST_DIR, ".claude"), { recursive: true });
    writeFileSync(
      settingsPath,
      JSON.stringify({
        hooks: {
          Stop: [
            {
              matcher: "",
              hooks: [{ type: "command", command: "echo unrelated" }],
            },
          ],
        },
      })
    );
    installHook({ scope: "project", json: true });
    installHook({ uninstall: true, scope: "project", json: true });
    const settings = JSON.parse(readFileSync(settingsPath, "utf-8"));
    expect(settings.hooks.Stop.length).toBe(1);
    expect(settings.hooks.Stop[0].hooks[0].command).toBe("echo unrelated");
  });
});
