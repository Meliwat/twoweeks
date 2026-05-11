import { test, expect, describe } from "bun:test";
import { humanDuration, computeRatio, formatRatio } from "../src/format.ts";
import type { Session } from "../src/db.ts";

describe("humanDuration", () => {
  test("zero", () => {
    expect(humanDuration(0)).toBe("0ms");
  });

  test("milliseconds when under 1 second", () => {
    expect(humanDuration(500)).toBe("500ms");
  });

  test("seconds", () => {
    expect(humanDuration(1500)).toBe("1s");
  });

  test("days + hours + minutes", () => {
    const ms = 13 * 24 * 60 * 60 * 1000 + 23 * 60 * 60 * 1000 + 12 * 60 * 1000;
    expect(humanDuration(ms)).toBe("13d 23h 12m");
  });

  test("hours + minutes only", () => {
    const ms = 2 * 60 * 60 * 1000 + 30 * 60 * 1000;
    expect(humanDuration(ms)).toBe("2h 30m");
  });

  test("clamps negative to 0ms", () => {
    expect(humanDuration(-500)).toBe("0ms");
  });

  test("seconds hidden when days present", () => {
    const ms = 1 * 24 * 60 * 60 * 1000 + 5 * 1000;
    expect(humanDuration(ms)).toBe("1d");
  });
});

describe("formatRatio", () => {
  test("small numbers", () => {
    expect(formatRatio(425)).toBe("425x");
  });

  test("thousands", () => {
    expect(formatRatio(1234)).toBe("1.2Kx");
  });

  test("millions", () => {
    expect(formatRatio(31_015_385)).toBe("31.0Mx");
  });

  test("infinity", () => {
    expect(formatRatio(Infinity)).toBe("∞x");
  });

  test("1", () => {
    expect(formatRatio(1)).toBe("1x");
  });

  test("boundary 999 stays normal", () => {
    expect(formatRatio(999)).toBe("999x");
  });

  test("boundary 1000 goes K", () => {
    expect(formatRatio(1000)).toBe("1.0Kx");
  });
});

describe("computeRatio", () => {
  function sessionWith(actualMs: number, etaMs = 14 * 24 * 60 * 60 * 1000): Session {
    return {
      id: 1,
      task: "test",
      eta_text: "2 weeks",
      eta_ms: etaMs,
      started_at: 1000,
      shipped_at: 1000 + actualMs,
      abandoned: 0,
    };
  }

  test("typical case (47 minutes vs 2 weeks)", () => {
    const ratio = computeRatio(sessionWith(47 * 60 * 1000));
    expect(ratio).toBe(429);
  });

  test("instant ship returns Infinity", () => {
    const ratio = computeRatio(sessionWith(0));
    expect(ratio).toBe(Infinity);
  });

  test("throws if not shipped", () => {
    const s: Session = {
      id: 1,
      task: "t",
      eta_text: "2 weeks",
      eta_ms: 1,
      started_at: 0,
      shipped_at: null,
      abandoned: 0,
    };
    expect(() => computeRatio(s)).toThrow();
  });

  test("ratio of 1 for matching duration", () => {
    expect(computeRatio(sessionWith(1209600000))).toBe(1);
  });

  test("over-budget returns sub-1 ratio rounded", () => {
    // shipped at 2x the ETA → 0.5 → rounded to 1 (Math.round rounds half-to-even, but 0.5 → 1 here)
    expect(computeRatio(sessionWith(2 * 1209600000))).toBeLessThanOrEqual(1);
  });
});
