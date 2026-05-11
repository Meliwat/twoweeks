import { readFileSync, existsSync } from "node:fs";

const UNIT_MS: Record<string, number> = {
  minute: 60 * 1000,
  hour: 60 * 60 * 1000,
  day: 24 * 60 * 60 * 1000,
  week: 7 * 24 * 60 * 60 * 1000,
  month: 30 * 24 * 60 * 60 * 1000,
};

const NUMBER_WORDS: Record<string, number> = {
  a: 1,
  an: 1,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
};

export interface EstimateMatch {
  text: string;
  ms: number;
  quote: string;
}

function numericValue(raw: string): number | null {
  const trimmed = raw.trim().toLowerCase();
  if (/^\d+(?:\.\d+)?$/.test(trimmed)) {
    const n = parseFloat(trimmed);
    if (n > 0) return n;
    return null;
  }
  return NUMBER_WORDS[trimmed] ?? null;
}

/**
 * Find every plan-shaped estimate phrase in the text. Returns matches sorted
 * by ms descending so the caller can take the largest (the outer time window).
 *
 * Patterns recognised:
 *   - "2 weeks", "three months", "a day", "5 hours"
 *   - "weeks 1-6", "weeks 1 through 6", "weeks 1 to 6"  (upper bound wins)
 *   - "about 2 weeks", "around 3 days", "roughly an hour"
 *
 * Deliberately conservative. Single bare numbers without units, or "in the
 * first week" without an anchor, are skipped — too many false positives.
 */
export function findEstimates(text: string): EstimateMatch[] {
  if (!text) return [];
  const matches: EstimateMatch[] = [];

  // Plain "N units" pattern (anchored by word boundary; allows word numbers).
  // Examples: "2 weeks", "about 3 months", "around a day", "roughly five hours"
  const plainRe =
    /(?:about|around|roughly|approximately|maybe|likely|probably|estimated?|estimate(?:d)?\s+at|takes?|take\s+about|will\s+take|should\s+take)?\s*(\d+(?:\.\d+)?|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|a|an)\s+(minute|hour|day|week|month)s?(?:\s+of\s+(?:focused\s+)?work)?/gi;

  for (const m of text.matchAll(plainRe)) {
    const n = numericValue(m[1]);
    const unit = m[2].toLowerCase();
    if (n === null || !UNIT_MS[unit]) continue;
    const ms = n * UNIT_MS[unit];
    if (ms <= 0) continue;
    const valueText = formatEstimateText(n, unit);
    matches.push({
      text: valueText,
      ms,
      quote: m[0].trim(),
    });
  }

  // "weeks 1-6" / "weeks 1 through 6" / "days 2 to 5"
  const rangeRe = /(minute|hour|day|week|month)s?\s+\d+\s*(?:-|–|through|to)\s*(\d+)/gi;
  for (const m of text.matchAll(rangeRe)) {
    const unit = m[1].toLowerCase();
    const upper = parseInt(m[2], 10);
    if (!UNIT_MS[unit] || isNaN(upper) || upper <= 0) continue;
    const ms = upper * UNIT_MS[unit];
    matches.push({
      text: formatEstimateText(upper, unit),
      ms,
      quote: m[0].trim(),
    });
  }

  // "by end of week N" / "by week N"
  const byWeekRe = /by\s+(?:the\s+)?(?:end\s+of\s+)?(week|month|day)\s+(\d+)/gi;
  for (const m of text.matchAll(byWeekRe)) {
    const unit = m[1].toLowerCase();
    const n = parseInt(m[2], 10);
    if (!UNIT_MS[unit] || isNaN(n) || n <= 0) continue;
    matches.push({
      text: formatEstimateText(n, unit),
      ms: n * UNIT_MS[unit],
      quote: m[0].trim(),
    });
  }

  // Sort biggest first. Outer estimate wins.
  matches.sort((a, b) => b.ms - a.ms);
  return matches;
}

function formatEstimateText(n: number, unit: string): string {
  // Normalise to integer "N units" form when possible (matches the parseEta
  // surface that start() already uses). Fractions get rounded up to the nearest
  // unit because shipping faster than a half-week is still impressive.
  const rounded = Math.max(1, Math.round(n));
  return `${rounded} ${unit}${rounded === 1 ? "" : "s"}`;
}

export function bestEstimate(text: string): EstimateMatch | null {
  const all = findEstimates(text);
  return all[0] ?? null;
}

/**
 * Extract a likely task name from a user message. Strips polite prefixes,
 * trims, caps length. Returns null if the message is too short or noise.
 */
export function inferTaskFromUserMessage(message: string): string | null {
  if (!message) return null;
  let t = message.replace(/\s+/g, " ").trim();

  // Strip common polite leaders.
  const leaders = [
    /^(?:hi|hey|hello)[\s,.!]+/i,
    /^(?:can|could|would|will)\s+you\s+/i,
    /^(?:please\s+)?help\s+me\s+/i,
    /^please\s+/i,
    /^i\s+(?:want|need|would\s+like)\s+(?:to|you\s+to)\s+/i,
    /^let'?s\s+/i,
    /^we\s+need\s+to\s+/i,
  ];
  for (let pass = 0; pass < 3; pass++) {
    for (const re of leaders) {
      const before = t;
      t = t.replace(re, "");
      if (t !== before) break;
    }
  }

  t = t.trim().replace(/^[.,;:!?]+/, "").trim();
  if (t.length < 3) return null;

  // Take the first sentence (or first 80 chars, whichever is shorter).
  const sentenceEnd = t.search(/[.!?]\s|[\n\r]/);
  if (sentenceEnd > 2) t = t.slice(0, sentenceEnd);

  // Strip trailing terminal punctuation ("build the auth flow?" → "build the auth flow").
  t = t.replace(/[.!?]+\s*$/, "").trim();

  const chars = [...t];
  if (chars.length > 80) t = chars.slice(0, 79).join("") + "…";

  return t.trim();
}

interface TranscriptResult {
  lastAssistantText: string;
  lastUserText: string;
}

/**
 * Read a Claude Code transcript (JSONL). Returns the most recent assistant
 * message text and the most recent user message that preceded it. Tolerant of
 * shape variation — returns empty strings rather than throwing.
 */
export function readTranscript(path: string): TranscriptResult {
  const empty = { lastAssistantText: "", lastUserText: "" };
  if (!path || !existsSync(path)) return empty;

  let raw: string;
  try {
    raw = readFileSync(path, "utf-8");
  } catch {
    return empty;
  }

  const lines = raw.split("\n").filter((l) => l.trim().length > 0);
  let lastAssistant = "";
  let lastAssistantIndex = -1;
  const events: Array<{ role: "user" | "assistant"; text: string }> = [];

  for (let i = 0; i < lines.length; i++) {
    const text = extractTextFromLine(lines[i]);
    if (!text) continue;
    if (text.role === "assistant") {
      events.push(text);
      lastAssistantIndex = events.length - 1;
    } else if (text.role === "user") {
      events.push(text);
    }
  }

  if (lastAssistantIndex < 0) return empty;
  lastAssistant = events[lastAssistantIndex].text;

  // Walk backwards from the last assistant message to find the preceding user message.
  let lastUser = "";
  for (let i = lastAssistantIndex - 1; i >= 0; i--) {
    if (events[i].role === "user") {
      lastUser = events[i].text;
      break;
    }
  }

  return { lastAssistantText: lastAssistant, lastUserText: lastUser };
}

function extractTextFromLine(line: string): { role: "user" | "assistant"; text: string } | null {
  let obj: unknown;
  try {
    obj = JSON.parse(line);
  } catch {
    return null;
  }
  if (!obj || typeof obj !== "object") return null;
  const o = obj as Record<string, unknown>;

  // Claude Code transcript shapes vary across versions; handle the common ones.
  const typeField = o.type as string | undefined;
  const role = (o.role as string | undefined) ?? typeField;

  if (role !== "user" && role !== "assistant") return null;

  const message = (o.message ?? o) as Record<string, unknown>;
  const content = message.content;
  let text = "";

  if (typeof content === "string") {
    text = content;
  } else if (Array.isArray(content)) {
    for (const block of content) {
      if (block && typeof block === "object") {
        const b = block as Record<string, unknown>;
        if (b.type === "text" && typeof b.text === "string") {
          text += (text ? "\n" : "") + b.text;
        } else if (typeof b.text === "string") {
          text += (text ? "\n" : "") + b.text;
        }
      } else if (typeof block === "string") {
        text += (text ? "\n" : "") + block;
      }
    }
  }

  if (!text) return null;
  return { role: role as "user" | "assistant", text };
}
