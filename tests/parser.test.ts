import { test, expect, describe } from "bun:test";
import { writeFileSync, mkdirSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import {
  findEstimates,
  bestEstimate,
  inferTaskFromUserMessage,
  readTranscript,
} from "../src/parser.ts";

describe("findEstimates", () => {
  test("plain '2 weeks'", () => {
    const result = bestEstimate("This should take about 2 weeks of focused work.");
    expect(result).not.toBeNull();
    expect(result!.text).toBe("2 weeks");
    expect(result!.ms).toBe(2 * 7 * 24 * 60 * 60 * 1000);
  });

  test("word-numbers like 'three days'", () => {
    const result = bestEstimate("Three days should be plenty.");
    expect(result).not.toBeNull();
    expect(result!.text).toBe("3 days");
  });

  test("'a day' → 1 day", () => {
    const result = bestEstimate("Could be done in a day.");
    expect(result).not.toBeNull();
    expect(result!.ms).toBe(24 * 60 * 60 * 1000);
  });

  test("ranges like 'weeks 1-6' take the upper bound", () => {
    const result = bestEstimate("Phase plan: weeks 1-6 for the foundations.");
    expect(result).not.toBeNull();
    expect(result!.text).toBe("6 weeks");
  });

  test("'weeks 1 through 10' works", () => {
    const result = bestEstimate("Weeks 1 through 10: the core rebuild.");
    expect(result).not.toBeNull();
    expect(result!.text).toBe("10 weeks");
  });

  test("biggest estimate wins (outer time window)", () => {
    const text = "Week 1: setup (2 days). Weeks 2-6: implementation. Then a final 1 week of polish.";
    const result = bestEstimate(text);
    expect(result).not.toBeNull();
    expect(result!.text).toBe("6 weeks");
  });

  test("returns null on text with no estimate", () => {
    const result = bestEstimate("This is just a description with no time mentioned.");
    expect(result).toBeNull();
  });

  test("returns null on empty input", () => {
    expect(bestEstimate("")).toBeNull();
    expect(bestEstimate("   ")).toBeNull();
  });

  test("ignores bare numbers without units", () => {
    const result = bestEstimate("There are 47 reasons to do this.");
    expect(result).toBeNull();
  });

  test("captures the matched quote verbatim", () => {
    const result = bestEstimate("Honestly, about 3 months of focused work.");
    expect(result).not.toBeNull();
    expect(result!.quote.toLowerCase()).toContain("3 months");
  });

  test("'by end of week 4'", () => {
    const result = bestEstimate("We can ship by end of week 4.");
    expect(result).not.toBeNull();
    expect(result!.text).toBe("4 weeks");
  });

  test("multiple findEstimates returns sorted desc", () => {
    const all = findEstimates("First a day, then 2 weeks, then maybe 3 months.");
    expect(all.length).toBeGreaterThanOrEqual(3);
    for (let i = 1; i < all.length; i++) {
      expect(all[i - 1].ms).toBeGreaterThanOrEqual(all[i].ms);
    }
  });
});

describe("inferTaskFromUserMessage", () => {
  test("strips 'Can you'", () => {
    expect(inferTaskFromUserMessage("Can you build the auth flow?")).toBe("build the auth flow");
  });

  test("strips 'Please help me'", () => {
    expect(inferTaskFromUserMessage("Please help me ship the migration")).toBe("ship the migration");
  });

  test("strips greetings", () => {
    expect(inferTaskFromUserMessage("Hi, can you refactor the parser")).toBe("refactor the parser");
  });

  test("takes first sentence", () => {
    expect(inferTaskFromUserMessage("Build the dashboard. Then add auth.")).toBe(
      "Build the dashboard"
    );
  });

  test("returns null on noise", () => {
    expect(inferTaskFromUserMessage("")).toBeNull();
    expect(inferTaskFromUserMessage("ok")).toBeNull();
  });

  test("caps long input", () => {
    const long = "Build the auth flow with a fully featured user dashboard and a payment-integrated subscription model";
    const result = inferTaskFromUserMessage(long);
    expect(result).not.toBeNull();
    expect([...result!].length).toBeLessThanOrEqual(80);
  });
});

describe("readTranscript", () => {
  const TEST_DIR = `/tmp/twoweeks-parser-test-${process.pid}`;

  function setup(): string {
    if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true, force: true });
    mkdirSync(TEST_DIR, { recursive: true });
    return TEST_DIR;
  }

  test("returns empty for missing file", () => {
    const r = readTranscript("/tmp/does-not-exist-twoweeks.jsonl");
    expect(r.lastAssistantText).toBe("");
    expect(r.lastUserText).toBe("");
  });

  test("parses Claude Code-style transcript with content array", () => {
    const dir = setup();
    const path = join(dir, "transcript.jsonl");
    const lines = [
      JSON.stringify({ type: "user", message: { content: "Can you build a pomodoro CLI?" } }),
      JSON.stringify({
        type: "assistant",
        message: { content: [{ type: "text", text: "Sure, this should take about 2 weeks of focused work." }] },
      }),
    ];
    writeFileSync(path, lines.join("\n"));
    const r = readTranscript(path);
    expect(r.lastUserText).toContain("pomodoro");
    expect(r.lastAssistantText).toContain("2 weeks");
  });

  test("finds the most recent user message before the last assistant", () => {
    const dir = setup();
    const path = join(dir, "transcript.jsonl");
    const lines = [
      JSON.stringify({ role: "user", content: "first request" }),
      JSON.stringify({ role: "assistant", content: "first response" }),
      JSON.stringify({ role: "user", content: "second request: build the thing" }),
      JSON.stringify({ role: "assistant", content: "second response: this is 3 weeks" }),
    ];
    writeFileSync(path, lines.join("\n"));
    const r = readTranscript(path);
    expect(r.lastUserText).toContain("second request");
    expect(r.lastAssistantText).toContain("3 weeks");
  });

  test("tolerates malformed JSONL lines", () => {
    const dir = setup();
    const path = join(dir, "transcript.jsonl");
    const lines = [
      "this is not json",
      JSON.stringify({ role: "assistant", content: "hello, 4 days" }),
      "{broken",
    ];
    writeFileSync(path, lines.join("\n"));
    const r = readTranscript(path);
    expect(r.lastAssistantText).toContain("4 days");
  });
});
