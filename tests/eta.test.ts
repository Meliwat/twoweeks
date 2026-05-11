import { test, expect, describe } from "bun:test";
import { parseEta, DEFAULT_ETA_MS, DEFAULT_ETA_TEXT } from "../src/eta.ts";

describe("parseEta", () => {
  test("parses '2 weeks'", () => {
    const r = parseEta("2 weeks");
    expect(r.text).toBe("2 weeks");
    expect(r.ms).toBe(2 * 7 * 24 * 60 * 60 * 1000);
  });

  test("parses '1 day'", () => {
    expect(parseEta("1 day").ms).toBe(24 * 60 * 60 * 1000);
  });

  test("parses '5 hours'", () => {
    expect(parseEta("5 hours").ms).toBe(5 * 60 * 60 * 1000);
  });

  test("parses singular unit", () => {
    expect(parseEta("1 week").ms).toBe(7 * 24 * 60 * 60 * 1000);
  });

  test("parses '3 months' as 90 days", () => {
    expect(parseEta("3 months").ms).toBe(3 * 30 * 24 * 60 * 60 * 1000);
  });

  test("parses '30 minutes'", () => {
    expect(parseEta("30 minutes").ms).toBe(30 * 60 * 1000);
  });

  test("trims whitespace", () => {
    expect(parseEta("  2 weeks  ").ms).toBe(2 * 7 * 24 * 60 * 60 * 1000);
  });

  test("accepts case-insensitive unit", () => {
    expect(parseEta("2 WEEKS").ms).toBe(2 * 7 * 24 * 60 * 60 * 1000);
  });

  test("accepts no-space form", () => {
    expect(parseEta("2weeks").ms).toBe(2 * 7 * 24 * 60 * 60 * 1000);
  });

  test("throws on garbage input", () => {
    expect(() => parseEta("invalid")).toThrow();
    expect(() => parseEta("")).toThrow();
    expect(() => parseEta("2 fortnights")).toThrow();
    expect(() => parseEta("weeks")).toThrow();
  });

  test("DEFAULT_ETA_MS is 2 weeks", () => {
    expect(DEFAULT_ETA_MS).toBe(14 * 24 * 60 * 60 * 1000);
    expect(DEFAULT_ETA_TEXT).toBe("2 weeks");
  });
});
