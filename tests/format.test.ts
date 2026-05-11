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
  test("integer ratio above 10", () => {
    expect(formatRatio(425)).toBe("425x");
  });

  test("ratio between 1 and 10 gets 2 decimals", () => {
    expect(formatRatio(1.5)).toBe("1.50x");
    expect(formatRatio(9.99)).toBe("9.99x");
  });

  test("ratio between 10 and 1000 rounds to integer", () => {
    expect(formatRatio(12.7)).toBe("13x");
  });

  test("thousands compact", () => {
    expect(formatRatio(1234)).toBe("1.2Kx");
  });

  test("millions compact", () => {
    expect(formatRatio(31_015_385)).toBe("31.0Mx");
  });

  test("sub-1 ratio gets 3 decimals (over-budget case)", () => {
    expect(formatRatio(0.5)).toBe("0.500x");
    expect(formatRatio(0.123)).toBe("0.123x");
  });

  test("infinity", () => {
    expect(formatRatio(Infinity)).toBe("∞x");
  });

  test("ratio of exactly 1", () => {
    expect(formatRatio(1)).toBe("1.00x");
  });

  test("boundary at 1000 goes to Kx", () => {
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

  test("typical case (47 minutes vs 2 weeks) ~= 428.5", () => {
    const ratio = computeRatio(sessionWith(47 * 60 * 1000));
    expect(ratio).toBeGreaterThan(428);
    expect(ratio).toBeLessThan(429);
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

  test("over-budget returns sub-1 ratio (the funny case)", () => {
    const ratio = computeRatio(sessionWith(2 * 1209600000));
    expect(ratio).toBe(0.5);
  });
});
