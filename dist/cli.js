#!/usr/bin/env node

// src/db.ts
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
function dbPath() {
  const dir = process.env.TWOWEEKS_HOME ?? join(homedir(), ".twoweeks");
  if (!existsSync(dir))
    mkdirSync(dir, { recursive: true });
  return join(dir, "history.json");
}
function load() {
  const path = dbPath();
  if (!existsSync(path)) {
    return { version: 1, next_id: 1, sessions: [] };
  }
  try {
    const raw = readFileSync(path, "utf-8");
    const parsed = JSON.parse(raw);
    if (!parsed.sessions || typeof parsed.next_id !== "number") {
      return { version: 1, next_id: 1, sessions: [] };
    }
    return parsed;
  } catch {
    return { version: 1, next_id: 1, sessions: [] };
  }
}
function save(store) {
  writeFileSync(dbPath(), JSON.stringify(store, null, 2));
}
function createSession(task, etaText, etaMs, quote) {
  const store = load();
  const session = {
    id: store.next_id,
    task,
    eta_text: etaText,
    eta_ms: etaMs,
    started_at: Date.now(),
    shipped_at: null,
    abandoned: 0,
    ...quote ? { quote } : {}
  };
  store.sessions.push(session);
  store.next_id++;
  save(store);
  return session;
}
function getActiveSessions() {
  const { sessions } = load();
  return sessions.filter((s) => s.shipped_at === null && s.abandoned === 0).sort((a, b) => b.started_at - a.started_at);
}
function getMostRecentActive() {
  return getActiveSessions()[0] ?? null;
}
function getSessionById(id) {
  const { sessions } = load();
  return sessions.find((s) => s.id === id) ?? null;
}
function shipSession(id) {
  const store = load();
  const session = store.sessions.find((s) => s.id === id);
  if (!session || session.shipped_at !== null || session.abandoned === 1) {
    return session ?? null;
  }
  session.shipped_at = Date.now();
  save(store);
  return session;
}
function abandonSession(id) {
  const store = load();
  const session = store.sessions.find((s) => s.id === id);
  if (!session)
    return null;
  session.abandoned = 1;
  save(store);
  return session;
}
function getMostRecentShipped() {
  return getAllShipped()[0] ?? null;
}
function getAllShipped() {
  const { sessions } = load();
  return sessions.filter((s) => s.shipped_at !== null && s.abandoned === 0).sort((a, b) => b.shipped_at - a.shipped_at);
}
function getStats() {
  const { sessions } = load();
  const shipped = sessions.filter((s) => s.shipped_at !== null && s.abandoned === 0);
  const abandoned = sessions.filter((s) => s.abandoned === 1);
  let totalSavedMs = 0;
  for (const s of shipped) {
    const actual = s.shipped_at - s.started_at;
    if (actual < s.eta_ms)
      totalSavedMs += s.eta_ms - actual;
  }
  return {
    total: sessions.length,
    shipped: shipped.length,
    abandoned: abandoned.length,
    totalSavedMs
  };
}

// src/eta.ts
var UNITS = {
  minute: 60 * 1000,
  hour: 60 * 60 * 1000,
  day: 24 * 60 * 60 * 1000,
  week: 7 * 24 * 60 * 60 * 1000,
  month: 30 * 24 * 60 * 60 * 1000
};
function parseEta(text) {
  const match = text.trim().toLowerCase().match(/^(\d+)\s*(minute|hour|day|week|month)s?$/);
  if (!match) {
    throw new Error(`Could not parse ETA "${text}". Examples: "2 weeks", "3 months", "1 day", "5 hours".`);
  }
  const n = parseInt(match[1], 10);
  const unit = match[2];
  return { text: text.trim(), ms: n * UNITS[unit] };
}
var SAMPLE_ETA_MS = 14 * 24 * 60 * 60 * 1000;

// src/flair.ts
var STATUS_MESSAGES = [
  "The AI was sure of it.",
  "Plenty of time.",
  "The estimate stands.",
  "The AI is still confident.",
  "Worst case, the AI is right.",
  "The countdown continues.",
  "The AI did not factor in the existence of itself.",
  "Plenty of token budget for the wait.",
  "The estimate is firm. The AI insists.",
  "Trust the process."
];
function randomFlair() {
  return STATUS_MESSAGES[Math.floor(Math.random() * STATUS_MESSAGES.length)];
}
function milestoneFor(ratio) {
  if (!isFinite(ratio)) {
    return "\uD83C\uDF0C  Submit this to Nature.";
  }
  if (ratio >= 1e6) {
    return "\uD83D\uDCA5  Million-x compression. Frame it.";
  }
  if (ratio >= 1e5) {
    return "\uD83D\uDD25  Six-figure compression. The AI is recalibrating.";
  }
  if (ratio >= 1e4) {
    return "\uD83D\uDE80  Five-figure compression. Solid Tuesday.";
  }
  if (ratio >= 1000) {
    return "✨  Four-figure compression.";
  }
  if (ratio >= 100) {
    return "\uD83C\uDFAF  Triple-digit compression.";
  }
  if (ratio >= 10) {
    return "\uD83D\uDC4D  Double-digit compression.";
  }
  if (ratio >= 2) {
    return "\uD83D\uDCC8  Faster than estimated.";
  }
  if (ratio >= 1) {
    return "\uD83E\uDD1D  Within a hair of the estimate.";
  }
  return "\uD83D\uDC22  The AI was, against all odds, correct.";
}

// src/colors.ts
function colorsEnabled() {
  if (!process.stdout.isTTY)
    return false;
  const nc = process.env.NO_COLOR;
  if (nc !== undefined && nc !== "")
    return false;
  return true;
}
function wrap(code) {
  return (text) => colorsEnabled() ? `\x1B[${code}m${text}\x1B[0m` : text;
}
var c = {
  bold: wrap("1"),
  dim: wrap("2"),
  italic: wrap("3"),
  underline: wrap("4"),
  red: wrap("31"),
  green: wrap("32"),
  yellow: wrap("33"),
  blue: wrap("34"),
  magenta: wrap("35"),
  cyan: wrap("36"),
  white: wrap("37"),
  brightRed: wrap("91"),
  brightGreen: wrap("92"),
  brightYellow: wrap("93"),
  brightCyan: wrap("96"),
  brightWhite: wrap("97"),
  bgRed: wrap("41")
};

// src/format.ts
var MAX_TASK_DISPLAY = 60;
function truncateTask(task) {
  const chars = [...task];
  if (chars.length <= MAX_TASK_DISPLAY)
    return task;
  return chars.slice(0, MAX_TASK_DISPLAY - 1).join("") + "…";
}
function humanDuration(ms) {
  const abs = Math.max(0, Math.floor(ms));
  if (abs < 1000) {
    return `${abs}ms`;
  }
  const days = Math.floor(abs / (24 * 60 * 60 * 1000));
  const hours = Math.floor(abs % (24 * 60 * 60 * 1000) / (60 * 60 * 1000));
  const minutes = Math.floor(abs % (60 * 60 * 1000) / (60 * 1000));
  const seconds = Math.floor(abs % (60 * 1000) / 1000);
  const parts = [];
  if (days > 0)
    parts.push(`${days}d`);
  if (hours > 0)
    parts.push(`${hours}h`);
  if (minutes > 0)
    parts.push(`${minutes}m`);
  if (seconds > 0 && days === 0)
    parts.push(`${seconds}s`);
  return parts.join(" ") || "0s";
}
function humanDurationSpoken(ms) {
  const abs = Math.max(0, Math.floor(ms));
  if (abs < 1000)
    return `${abs} milliseconds`;
  const days = Math.floor(abs / (24 * 60 * 60 * 1000));
  const hours = Math.floor(abs % (24 * 60 * 60 * 1000) / (60 * 60 * 1000));
  const minutes = Math.floor(abs % (60 * 60 * 1000) / (60 * 1000));
  const seconds = Math.floor(abs % (60 * 1000) / 1000);
  const parts = [];
  if (days > 0)
    parts.push(`${days} ${days === 1 ? "day" : "days"}`);
  if (hours > 0)
    parts.push(`${hours} ${hours === 1 ? "hour" : "hours"}`);
  if (minutes > 0)
    parts.push(`${minutes} ${minutes === 1 ? "minute" : "minutes"}`);
  if (seconds > 0 && days === 0)
    parts.push(`${seconds} ${seconds === 1 ? "second" : "seconds"}`);
  return parts.join(" ") || "zero seconds";
}
function compactRemaining(session) {
  const remaining = session.started_at + session.eta_ms - Date.now();
  if (remaining <= 0) {
    return c.brightYellow("0s") + c.dim(" (your AI was overconfident, somehow)");
  }
  return c.brightCyan(humanDuration(remaining));
}
function computeRatio(session) {
  if (session.shipped_at === null || session.shipped_at === undefined) {
    throw new Error("Session not shipped");
  }
  const actualMs = session.shipped_at - session.started_at;
  if (actualMs <= 0)
    return Infinity;
  return session.eta_ms / actualMs;
}
function formatRatio(ratio) {
  if (!isFinite(ratio))
    return "∞x";
  if (ratio >= 1e6)
    return `${(ratio / 1e6).toFixed(1)}Mx`;
  if (ratio >= 1000)
    return `${(ratio / 1000).toFixed(1)}Kx`;
  if (ratio >= 10)
    return `${Math.round(ratio)}x`;
  if (ratio >= 1)
    return `${ratio.toFixed(2)}x`;
  return `${ratio.toFixed(3)}x`;
}
function maybeEmoji(s, opts) {
  if (opts.plain || opts.noEmoji)
    return s.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2300}-\u{23FF}]/gu, "").trim();
  return s;
}
function resultCard(session, milestone, opts = {}) {
  if (session.shipped_at === null || session.shipped_at === undefined) {
    throw new Error("Session not shipped");
  }
  const actualMs = session.shipped_at - session.started_at;
  const ratio = computeRatio(session);
  const overBudget = ratio < 1;
  const savedDelta = overBudget ? actualMs - session.eta_ms : session.eta_ms - actualMs;
  const ratioText = formatRatio(ratio);
  const task = truncateTask(session.task);
  if (opts.plain) {
    const verdict = overBudget ? "Cost" : "Saved";
    const sign2 = overBudget ? "-" : "+";
    const lines2 = [
      "Shipped.",
      `Task: ${task}`,
      `Estimated: ${session.eta_text}`,
      `Actual: ${humanDurationSpoken(actualMs)}`,
      `Compression: ${ratioText} ${overBudget ? "of the AI's estimate (slower than predicted)" : "faster than the AI thought"}`,
      `${verdict}: ${sign2}${humanDurationSpoken(savedDelta)}`
    ];
    if (milestone)
      lines2.push("Note: " + maybeEmoji(milestone, opts));
    return lines2.join(`
`) + `
`;
  }
  const rule = c.dim("──────────────────────────────────────────");
  const label = (s) => c.dim(s);
  const verdictLabel = overBudget ? "Cost:" : "Saved:";
  const sign = overBudget ? "-" : "+";
  const verdictColor = overBudget ? c.red : c.green;
  const ratioColor = isFinite(ratio) ? c.brightGreen : c.brightCyan;
  const shippedHeader = opts.noEmoji ? c.brightGreen(c.bold("SHIPPED")) : c.brightGreen(c.bold("\uD83C\uDFAF SHIPPED"));
  const lines = [
    "",
    shippedHeader,
    rule,
    `${label("Task:")}        ${c.bold(task)}`,
    `${label("Estimated:")}   ${c.italic(session.eta_text)}`,
    `${label("Actual:")}      ${c.brightYellow(humanDuration(actualMs))}`,
    `${label("Compression:")} ${ratioColor(c.bold(ratioText))} ${c.dim(overBudget ? "(the AI, against all odds, was right)" : "faster than the AI thought")}`,
    `${label(verdictLabel + "      ")} ${verdictColor(sign + humanDuration(savedDelta))}`,
    rule
  ];
  if (milestone) {
    lines.push("");
    lines.push(c.brightYellow(c.bold(maybeEmoji(milestone, opts))));
  }
  lines.push("");
  return lines.join(`
`);
}
function statusCard(session, flair, opts = {}) {
  const task = truncateTask(session.task);
  if (opts.plain) {
    const remaining = session.started_at + session.eta_ms - Date.now();
    const remainingText = remaining > 0 ? humanDurationSpoken(remaining) : "zero seconds (overdue)";
    return `Active: ${task}. Time remaining: ${remainingText}. ${flair}
`;
  }
  const clock = opts.noEmoji ? "[active]" : "⏰";
  const lines = [
    "",
    `${c.brightCyan(clock)} ${compactRemaining(session)} ${c.dim("remaining for:")} ${c.bold(task)}`,
    `   ${c.dim(c.italic(flair))}`,
    ""
  ];
  return lines.join(`
`);
}
function startCard(session, flair, opts = {}) {
  const task = truncateTask(session.task);
  if (opts.plain) {
    return `Started timer: ${task}. Estimate: ${session.eta_text}. ${flair} Run 'twoweeks ship' when done.
`;
  }
  const clock = opts.noEmoji ? "[active]" : "⏰";
  const lines = [
    "",
    `${c.brightCyan(clock)} ${c.brightCyan(session.eta_text)} ${c.dim("remaining for:")} ${c.bold(task)}`,
    `   ${c.dim(c.italic(flair))}`,
    "",
    `   ${c.dim("(run `twoweeks ship` when you're done)")}`,
    ""
  ];
  return lines.join(`
`);
}
function historyTable(shipped, stats, opts = {}) {
  if (opts.plain) {
    if (shipped.length === 0)
      return `No shipped sessions yet.
`;
    const rows2 = shipped.slice(0, 10).map((s) => {
      const actualMs = s.shipped_at - s.started_at;
      return `  ${s.id}. ${truncateTask(s.task)} — estimated ${s.eta_text}, actual ${humanDurationSpoken(actualMs)}, ratio ${formatRatio(s.ratio)}`;
    });
    const summary = [
      `Total shipped: ${stats.shipped}.`,
      `Best compression: ${stats.bestRatio !== null ? formatRatio(stats.bestRatio) : "none"}.`,
      `Average compression: ${stats.avgRatio !== null ? formatRatio(stats.avgRatio) : "none"}.`,
      `Lifetime time saved: ${humanDurationSpoken(stats.totalSavedMs)}.`
    ];
    if (stats.abandoned > 0)
      summary.push(`Abandoned: ${stats.abandoned}.`);
    return ["Shipped sessions:", ...rows2, "", ...summary].join(`
`) + `
`;
  }
  if (shipped.length === 0) {
    return [
      "",
      c.dim("No shipped sessions yet. Ship one and the brag accumulates here."),
      ""
    ].join(`
`);
  }
  const rule = c.dim("─".repeat(74));
  const header = c.bold(c.dim("  id   ")) + c.bold(c.dim("ratio    ")) + c.bold(c.dim("actual       ")) + c.bold(c.dim("task"));
  const rows = shipped.slice(0, 10).map((s) => {
    const actualMs = s.shipped_at - s.started_at;
    const id = String(s.id).padEnd(5);
    const ratio = formatRatio(s.ratio).padEnd(8);
    const actual = humanDuration(actualMs).padEnd(12);
    const task = truncateTask(s.task);
    return `  ${c.dim(id)} ${c.brightGreen(ratio)} ${c.brightYellow(actual)} ${task}`;
  });
  const header_icon = opts.noEmoji ? "" : "\uD83D\uDCDC ";
  const lines = [
    "",
    c.brightGreen(c.bold(`${header_icon}SHIPPED SESSIONS`)),
    rule,
    header,
    ...rows,
    rule,
    "",
    `  ${c.dim("Total shipped:")}   ${c.bold(String(stats.shipped))}`,
    `  ${c.dim("Best compression:")} ${c.brightGreen(c.bold(stats.bestRatio !== null ? formatRatio(stats.bestRatio) : "—"))}`,
    `  ${c.dim("Avg compression:")}  ${c.brightCyan(stats.avgRatio !== null ? formatRatio(stats.avgRatio) : "—")}`,
    `  ${c.dim("Lifetime saved:")}   ${c.green(humanDuration(stats.totalSavedMs))}`
  ];
  if (stats.abandoned > 0) {
    lines.push(`  ${c.dim(`Abandoned:        ${stats.abandoned}`)}`);
  }
  lines.push("");
  return lines.join(`
`);
}

// src/commands/start.ts
var MISSING_ETA_HELP = `Pass the AI's estimate as the second argument or via --eta:

  twoweeks "build the auth flow" "2 weeks"
  twoweeks "build the auth flow" "3 months"
  twoweeks "build the auth flow" --eta "5 hours"

Accepts: minute(s), hour(s), day(s), week(s), month(s).

Tip: run \`twoweeks install-hook\` to auto-capture estimates from Claude Code.`;
function start(args) {
  if (!args.task || args.task.trim().length === 0) {
    if (args.json) {
      console.error(JSON.stringify({ ok: false, error: "task is required" }));
    } else if (args.plain) {
      console.error('Error: task is required. Try: twoweeks "build the auth flow" "2 weeks"');
    } else {
      console.error(c.brightRed("Error:") + ' task is required. Try: twoweeks "build the auth flow" "2 weeks"');
    }
    return 1;
  }
  if (!args.eta) {
    if (args.json) {
      console.error(JSON.stringify({ ok: false, error: "eta_required", hint: "twoweeks needs the AI's estimate; pass it as the second arg or via --eta" }));
    } else if (args.plain) {
      console.error(`Error: missing AI estimate.
`);
      console.error(MISSING_ETA_HELP);
    } else {
      console.error("");
      console.error(c.brightRed("Error: missing AI estimate."));
      console.error("");
      console.error(MISSING_ETA_HELP);
      console.error("");
    }
    return 1;
  }
  const active = getMostRecentActive();
  if (active && !args.force) {
    if (args.json) {
      console.error(JSON.stringify({
        ok: false,
        error: "active_session_exists",
        active,
        hint: "ship or abandon first, or use --force"
      }));
    } else if (args.plain) {
      console.error(`Warning: active session "${active.task}" started ${new Date(active.started_at).toLocaleString()}.`);
      console.error("Ship or abandon it first, or rerun with --force to start a new one.");
    } else {
      console.log("");
      console.log(`${c.brightYellow("⚠️")}  You already have an active session: ${c.bold(active.task)}`);
      console.log(`   ${c.dim("Started " + new Date(active.started_at).toLocaleString() + ".")}`);
      console.log("");
      console.log(c.dim("Ship or abandon it first, or rerun with ") + c.bold("--force") + c.dim(" to start a new one in parallel."));
      console.log("");
    }
    return 2;
  }
  let eta;
  try {
    eta = parseEta(args.eta);
  } catch (err) {
    const msg = err.message;
    if (args.json) {
      console.error(JSON.stringify({ ok: false, error: msg }));
    } else if (args.plain) {
      console.error("Error: " + msg);
    } else {
      console.error(c.brightRed("Error:") + " " + msg);
    }
    return 1;
  }
  const session = createSession(args.task.trim(), eta.text, eta.ms, args.quote);
  if (args.json) {
    console.log(JSON.stringify({ ok: true, session }));
  } else {
    console.log(startCard(session, randomFlair(), { plain: args.plain, noEmoji: args.noEmoji }));
  }
  return 0;
}

// src/commands/status.ts
function status(args = {}) {
  const sessions = getActiveSessions();
  if (args.json) {
    console.log(JSON.stringify({ ok: true, active: sessions }));
    return 0;
  }
  if (sessions.length === 0) {
    if (args.plain) {
      console.log('No active sessions. Start one: twoweeks "build the auth flow" "2 weeks"');
    } else {
      console.log("");
      console.log(c.dim("No active sessions."));
      console.log("");
      console.log(c.dim("Start one: ") + c.bold('twoweeks "build the auth flow" "2 weeks"'));
      console.log("");
    }
    return 0;
  }
  for (const s of sessions) {
    console.log(statusCard(s, randomFlair(), { plain: args.plain, noEmoji: args.noEmoji }));
  }
  return 0;
}

// src/commands/share.ts
import { spawn } from "node:child_process";
import { platform } from "node:os";
var REPO_URL = "https://github.com/Meliwat/twoweeks";
var SHARE_VARIANTS = [
  ({ eta, ratio, duration, quote }) => `AI said "${eta}". Also AI: shipped in ${duration}.

Compression: ${ratio}.${quote ? `

The AI's exact words: "${quote}"` : ""}

twoweeks ⚙️ ${REPO_URL}`,
  ({ eta, ratio, duration }) => `AI estimate: "${eta}".
AI delivery: ${duration}.

AI beat AI by ${ratio}.

twoweeks ⚙️ ${REPO_URL}`,
  ({ eta, ratio, duration }) => `AI: "About ${eta} of focused work."
Also AI: ${duration}.

${ratio} faster than the AI predicted itself would be.

${REPO_URL}`,
  ({ eta, ratio, duration }) => `${ratio} compression on today's ship.

The AI quoted ${eta}. The AI shipped ${duration}.

${REPO_URL}`,
  ({ eta, ratio, duration, challenge }) => `AI said "${eta}". AI shipped in ${duration}. ${ratio}.${challenge ? `

${challenge} bet your AI can't top mine.` : ""}

${REPO_URL}`
];
function pickShareVariant(session, options = {}) {
  if (!session.shipped_at)
    throw new Error("Cannot share unshipped session");
  const actualMs = session.shipped_at - session.started_at;
  const ratio = computeRatio(session);
  const duration = humanDuration(actualMs);
  const ratioText = formatRatio(ratio);
  const variant = SHARE_VARIANTS[Math.floor(Math.random() * SHARE_VARIANTS.length)];
  return variant({
    eta: session.eta_text,
    ratio: ratioText,
    duration,
    quote: session.quote,
    challenge: options.challenge
  });
}
function buildShareUrl(session, target = "x", options = {}) {
  const text = pickShareVariant(session, options);
  switch (target) {
    case "x":
      return `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
    case "bluesky":
      return `https://bsky.app/intent/compose?text=${encodeURIComponent(text)}`;
    case "mastodon":
      return `https://toot.kytta.dev/?text=${encodeURIComponent(text)}`;
  }
}
function openUrl(url) {
  const cmd = platform() === "darwin" ? "open" : platform() === "win32" ? "start" : "xdg-open";
  try {
    spawn(cmd, [url], { detached: true, stdio: "ignore" }).unref();
  } catch {}
}
function share(args) {
  const session = args.id !== undefined ? getSessionById(args.id) : getMostRecentShipped();
  if (!session) {
    if (args.json) {
      console.error(JSON.stringify({ ok: false, error: "no_shipped_session" }));
    } else {
      console.error(c.brightRed("Error:") + " no shipped session to share. Ship one first with: " + c.bold("twoweeks ship"));
    }
    return 1;
  }
  if (session.shipped_at === null || session.shipped_at === undefined) {
    if (args.json) {
      console.error(JSON.stringify({ ok: false, error: "session_not_shipped", id: session.id }));
    } else {
      console.error(c.brightRed("Error:") + ` session ${session.id} ("${session.task}") hasn't shipped yet.`);
    }
    return 1;
  }
  const target = args.target ?? "x";
  const url = buildShareUrl(session, target, { challenge: args.challenge });
  if (args.json) {
    console.log(JSON.stringify({ ok: true, url, target, session_id: session.id }));
    return 0;
  }
  if (args.print) {
    console.log(url);
    return 0;
  }
  const targetName = target === "x" ? "X" : target === "bluesky" ? "Bluesky" : "Mastodon";
  console.log("");
  console.log(c.dim(`Opening ${targetName} with your brag pre-filled...`));
  console.log("");
  console.log(c.dim("If your browser doesn't open, here's the URL:"));
  console.log(c.cyan(url));
  console.log("");
  openUrl(url);
  return 0;
}

// src/screenshot.ts
import { readFileSync as readFileSync2, existsSync as existsSync2, mkdirSync as mkdirSync2, writeFileSync as writeFileSync2 } from "node:fs";
import { join as join2, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { homedir as homedir2 } from "node:os";
import { createHash } from "node:crypto";
import satori from "satori";
import { Resvg } from "@resvg/resvg-js";
function fontsDir() {
  try {
    if (typeof import.meta.dir === "string")
      return join2(import.meta.dir, "..", "assets", "fonts");
  } catch {}
  return join2(dirname(fileURLToPath(import.meta.url)), "..", "assets", "fonts");
}
function loadFonts() {
  const candidates = [
    fontsDir(),
    join2(process.cwd(), "assets", "fonts"),
    join2(homedir2(), ".twoweeks", "fonts")
  ];
  for (const dir of candidates) {
    const bold = join2(dir, "JetBrainsMono-Bold.ttf");
    const regular = join2(dir, "JetBrainsMono-Regular.ttf");
    if (existsSync2(bold) && existsSync2(regular)) {
      return [
        { name: "JetBrains Mono", data: readFileSync2(regular), weight: 400, style: "normal" },
        { name: "JetBrains Mono", data: readFileSync2(bold), weight: 700, style: "normal" }
      ];
    }
  }
  throw new Error("twoweeks: could not locate JetBrains Mono fonts. " + "Expected JetBrainsMono-Bold.ttf and JetBrainsMono-Regular.ttf in one of: " + candidates.join(", "));
}
var COLORS = {
  bg: "#1e1e2e",
  surface: "#313244",
  text: "#cdd6f4",
  subtext: "#a6adc8",
  dim: "#9399b2",
  green: "#a6e3a1",
  brightGreen: "#94e2d5",
  yellow: "#f9e2af",
  red: "#f38ba8",
  blue: "#89b4fa",
  mauve: "#cba6f7"
};
function truncate(s, n = 48) {
  const chars = [...s];
  return chars.length > n ? chars.slice(0, n - 1).join("") + "…" : s;
}
function stripEmoji(s) {
  return s.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2300}-\u{23FF}\u{1F100}-\u{1F1FF}]/gu, "").trim();
}
function brandStyle(ratio) {
  if (!isFinite(ratio))
    return COLORS.mauve;
  if (ratio >= 1000)
    return COLORS.green;
  if (ratio >= 100)
    return COLORS.brightGreen;
  if (ratio >= 1)
    return COLORS.yellow;
  return COLORS.red;
}
function sessionSlug(session) {
  const seed = `${session.id}|${session.task}|${session.started_at}|${session.shipped_at ?? 0}`;
  const h = createHash("sha256").update(seed).digest("hex");
  return h.slice(0, 6);
}
function cardTree(ctx) {
  const ratioColor = brandStyle(ctx.ratio);
  const overBudget = ctx.ratio < 1;
  const savedMs = overBudget ? ctx.actualMs - ctx.etaMs : ctx.etaMs - ctx.actualMs;
  const savedLabel = overBudget ? "Cost" : "Saved";
  const savedSign = overBudget ? "−" : "+";
  return {
    type: "div",
    props: {
      style: {
        width: "1200px",
        height: "630px",
        display: "flex",
        flexDirection: "column",
        backgroundColor: COLORS.bg,
        color: COLORS.text,
        padding: "56px 64px",
        fontFamily: "JetBrains Mono",
        position: "relative"
      },
      children: [
        {
          type: "div",
          props: {
            style: { display: "flex", justifyContent: "space-between", alignItems: "center" },
            children: [
              {
                type: "div",
                props: {
                  style: { color: COLORS.subtext, fontSize: "26px", fontWeight: 400 },
                  children: "twoweeks"
                }
              },
              {
                type: "div",
                props: {
                  style: { color: COLORS.subtext, fontSize: "20px", fontWeight: 400, letterSpacing: "3px" },
                  children: "SHIPPED"
                }
              }
            ]
          }
        },
        {
          type: "div",
          props: {
            style: {
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              marginTop: "28px",
              marginBottom: "28px"
            },
            children: [
              {
                type: "div",
                props: {
                  style: {
                    fontSize: "176px",
                    fontWeight: 700,
                    color: ratioColor,
                    lineHeight: 1
                  },
                  children: ctx.ratioText
                }
              },
              {
                type: "div",
                props: {
                  style: {
                    fontSize: "26px",
                    color: COLORS.subtext,
                    marginTop: "16px"
                  },
                  children: overBudget ? "(the AI, against all odds, was right)" : "faster than the AI thought"
                }
              }
            ]
          }
        },
        {
          type: "div",
          props: {
            style: {
              height: "1px",
              backgroundColor: COLORS.surface,
              width: "100%",
              marginBottom: "24px"
            }
          }
        },
        {
          type: "div",
          props: {
            style: { display: "flex", justifyContent: "space-between", gap: "32px" },
            children: [
              statBlock("Task", truncate(ctx.task, 36), COLORS.text),
              statBlock("Estimated", ctx.etaText, COLORS.subtext),
              statBlock("Actual", humanDuration(ctx.actualMs), COLORS.yellow),
              statBlock(savedLabel, `${savedSign}${humanDuration(savedMs)}`, overBudget ? COLORS.red : COLORS.green)
            ]
          }
        },
        ctx.milestone ? {
          type: "div",
          props: {
            style: {
              marginTop: "28px",
              color: COLORS.yellow,
              fontSize: "22px",
              fontWeight: 700,
              alignSelf: "center",
              textAlign: "center"
            },
            children: stripEmoji(ctx.milestone)
          }
        } : { type: "div", props: { children: "" } },
        {
          type: "div",
          props: {
            style: {
              marginTop: "auto",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              color: COLORS.dim,
              fontSize: "16px",
              fontWeight: 400
            },
            children: [
              {
                type: "div",
                props: { children: "github.com/Meliwat/twoweeks" }
              },
              {
                type: "div",
                props: {
                  style: { letterSpacing: "1px" },
                  children: ctx.slug ? `#${ctx.slug}` : ""
                }
              }
            ]
          }
        }
      ]
    }
  };
}
function statBlock(label, value, valueColor) {
  return {
    type: "div",
    props: {
      style: { display: "flex", flexDirection: "column", flex: 1, minWidth: 0 },
      children: [
        {
          type: "div",
          props: {
            style: { fontSize: "16px", color: COLORS.subtext, marginBottom: "6px", letterSpacing: "1px" },
            children: label.toUpperCase()
          }
        },
        {
          type: "div",
          props: {
            style: { fontSize: "28px", color: valueColor, fontWeight: 700 },
            children: value
          }
        }
      ]
    }
  };
}
async function renderCard(ctx) {
  const fonts = loadFonts();
  const svg = await satori(cardTree(ctx), {
    width: 1200,
    height: 630,
    fonts
  });
  const png = new Resvg(svg, { background: COLORS.bg }).render().asPng();
  return png;
}
async function renderShipCard(session) {
  if (session.shipped_at === null)
    throw new Error("Cannot render card for unshipped session");
  const actualMs = session.shipped_at - session.started_at;
  const ratio = computeRatio(session);
  return renderCard({
    task: session.task,
    etaText: session.eta_text,
    actualMs,
    etaMs: session.eta_ms,
    ratio,
    ratioText: formatRatio(ratio),
    milestone: milestoneFor(ratio),
    slug: sessionSlug(session)
  });
}
function defaultScreenshotPath(sessionId) {
  const dir = process.env.TWOWEEKS_HOME ? join2(process.env.TWOWEEKS_HOME, "screenshots") : join2(homedir2(), ".twoweeks", "screenshots");
  if (!existsSync2(dir))
    mkdirSync2(dir, { recursive: true });
  return join2(dir, `compression-${sessionId}.png`);
}
function altTextPath(pngPath) {
  return pngPath.replace(/\.png$/i, ".alt.txt");
}
function altTextForSession(session) {
  if (session.shipped_at === null)
    return "";
  const actualMs = session.shipped_at - session.started_at;
  const ratio = computeRatio(session);
  const overBudget = ratio < 1;
  const verdict = overBudget ? "slower" : "faster";
  return [
    `twoweeks brag card.`,
    `Task: ${session.task}.`,
    `The AI estimated ${session.eta_text}.`,
    `Actually shipped in ${humanDurationSpoken(actualMs)}.`,
    `That is ${formatRatio(ratio)} ${verdict} than the AI estimated.`,
    `Source: github.com/Meliwat/twoweeks`
  ].join(" ");
}
function writeScreenshot(path, png) {
  const dir = dirname(path);
  if (!existsSync2(dir))
    mkdirSync2(dir, { recursive: true });
  writeFileSync2(path, png);
}
function writeAltText(pngPath, altText) {
  writeFileSync2(altTextPath(pngPath), altText + `
`);
}

// src/commands/ship.ts
import { spawn as spawn2 } from "node:child_process";
import { platform as platform2 } from "node:os";
function pbcopyPng(path) {
  if (platform2() !== "darwin")
    return false;
  try {
    const proc = spawn2("osascript", ["-e", `set the clipboard to (read (POSIX file "${path}") as «class PNGf»)`], { stdio: "ignore" });
    return proc.pid !== undefined;
  } catch {
    return false;
  }
}
async function ship(args) {
  const active = getMostRecentActive();
  if (!active) {
    if (args.json) {
      console.error(JSON.stringify({ ok: false, error: "no_active_session" }));
    } else if (args.plain) {
      console.error('Error: no active session to ship. Start one: twoweeks "task" "2 weeks"');
    } else {
      console.error(c.brightRed("Error:") + " no active session to ship. Start one with: " + c.bold('twoweeks "task"'));
    }
    return 1;
  }
  const shipped = shipSession(active.id);
  if (!shipped || shipped.shipped_at === null) {
    if (args.json) {
      console.error(JSON.stringify({ ok: false, error: "ship_failed" }));
    } else {
      console.error((args.plain ? "Error: " : c.brightRed("Error:") + " ") + "failed to ship session.");
    }
    return 1;
  }
  const ratio = computeRatio(shipped);
  const milestone = milestoneFor(ratio);
  const target = args.shareTarget ?? "x";
  const url = buildShareUrl(shipped, target);
  const slug = sessionSlug(shipped);
  let screenshotPath;
  let altPath;
  let copied = false;
  if (args.screenshot) {
    try {
      const png = await renderShipCard(shipped);
      screenshotPath = args.screenshotOut ?? defaultScreenshotPath(shipped.id);
      writeScreenshot(screenshotPath, png);
      altPath = altTextPath(screenshotPath);
      writeAltText(screenshotPath, altTextForSession(shipped));
      if (args.copy) {
        copied = pbcopyPng(screenshotPath);
      }
    } catch (err) {
      if (!args.json) {
        const errMsg = err.message;
        if (args.plain)
          console.error("Screenshot failed: " + errMsg);
        else
          console.error(c.brightRed("Screenshot failed:") + " " + errMsg);
      }
    }
  }
  if (args.json) {
    const actualMs = shipped.shipped_at - shipped.started_at;
    console.log(JSON.stringify({
      ok: true,
      session: shipped,
      slug,
      ratio,
      ratio_formatted: formatRatio(ratio),
      actual_ms: actualMs,
      actual_human: humanDuration(actualMs),
      actual_spoken: humanDurationSpoken(actualMs),
      saved_ms: Math.max(0, shipped.eta_ms - actualMs),
      milestone,
      share_url: url,
      share_target: target,
      screenshot_path: screenshotPath,
      alt_text_path: altPath,
      copied_to_clipboard: copied
    }));
    if (args.share)
      openUrl(url);
    return 0;
  }
  console.log(resultCard(shipped, milestone, { plain: args.plain, noEmoji: args.noEmoji }));
  if (screenshotPath) {
    if (args.plain) {
      console.log(`Screenshot: ${screenshotPath}`);
      console.log(`Alt text: ${altPath}`);
      if (copied)
        console.log("(PNG copied to clipboard — Cmd+V into any compose box.)");
    } else {
      console.log(c.dim(args.noEmoji ? "Screenshot: " : "\uD83D\uDCF8 Screenshot: ") + c.bold(screenshotPath));
      console.log(c.dim("Alt text:   ") + c.dim(altPath ?? ""));
      if (copied)
        console.log(c.brightGreen("✓ PNG copied to clipboard — Cmd+V into any compose box."));
      console.log("");
    }
  }
  if (args.share) {
    const targetName = target === "x" ? "X" : target === "bluesky" ? "Bluesky" : "Mastodon";
    if (args.plain) {
      console.log(`Opening ${targetName} with your brag pre-filled. URL: ${url}`);
    } else {
      console.log(c.dim(`Opening ${targetName} with your brag pre-filled...`));
      console.log("");
      console.log(c.dim("If your browser doesn't open, here's the URL:"));
      console.log(c.cyan(url));
      console.log("");
    }
    openUrl(url);
  } else if (args.plain) {
    console.log(`Tweet it:   twoweeks share ${shipped.id}`);
    console.log(`Save PNG:   twoweeks ship --screenshot --copy`);
  } else {
    console.log(c.brightCyan("→ Tweet it:") + " " + c.bold(`twoweeks share ${shipped.id}`));
    console.log(c.dim("  Save PNG:  ") + c.bold(`twoweeks ship --screenshot --copy`));
    console.log("");
  }
  return 0;
}

// src/commands/abandon.ts
function abandon(args = {}) {
  const active = getMostRecentActive();
  if (!active) {
    if (args.json) {
      console.error(JSON.stringify({ ok: false, error: "no_active_session" }));
    } else {
      console.error((args.plain ? "Error: " : c.brightRed("Error:") + " ") + "no active session to abandon.");
    }
    return 1;
  }
  const abandoned = abandonSession(active.id);
  if (args.json) {
    console.log(JSON.stringify({ ok: true, session: abandoned }));
    return 0;
  }
  if (args.plain) {
    console.log(`Abandoned: ${active.task} (excluded from stats).`);
    return 0;
  }
  console.log("");
  console.log(c.brightYellow("\uD83C\uDFF3️") + "  " + c.dim("Abandoned: ") + c.bold(active.task));
  console.log(c.dim("   (Excluded from stats. No shame; start a new one any time.)"));
  console.log("");
  return 0;
}

// src/achievements.ts
var DAY_MS = 24 * 60 * 60 * 1000;
function ratiosOf(sessions) {
  return sessions.filter((s) => s.shipped_at !== null && s.abandoned === 0).map((s) => computeRatio(s));
}
function dayStreak(shipped) {
  if (shipped.length === 0)
    return 0;
  const days = new Set;
  for (const s of shipped) {
    if (s.shipped_at === null)
      continue;
    days.add(new Date(s.shipped_at).toISOString().slice(0, 10));
  }
  const sortedDays = [...days].sort();
  let longest = 1;
  let current = 1;
  for (let i = 1;i < sortedDays.length; i++) {
    const prev = new Date(sortedDays[i - 1] + "T00:00:00Z").getTime();
    const here = new Date(sortedDays[i] + "T00:00:00Z").getTime();
    if (here - prev === DAY_MS) {
      current++;
      longest = Math.max(longest, current);
    } else {
      current = 1;
    }
  }
  return longest;
}
function computeAchievements(sessions) {
  const shipped = sessions.filter((s) => s.shipped_at !== null && s.abandoned === 0);
  const ratios = ratiosOf(shipped);
  const finite = ratios.filter((r) => isFinite(r));
  const has100x = finite.some((r) => r >= 100);
  const has1Kx = finite.some((r) => r >= 1000);
  const has1Mx = finite.some((r) => r >= 1e6);
  const longestStreak = dayStreak(shipped);
  return [
    {
      id: "first_ship",
      name: "First Ship",
      description: "Ship your first session.",
      earned: shipped.length >= 1,
      progress: Math.min(shipped.length, 1),
      goal: 1
    },
    {
      id: "hat_trick",
      name: "Hat Trick",
      description: "Ship three sessions.",
      earned: shipped.length >= 3,
      progress: Math.min(shipped.length, 3),
      goal: 3
    },
    {
      id: "marathon",
      name: "Marathon",
      description: "Ship ten sessions.",
      earned: shipped.length >= 10,
      progress: Math.min(shipped.length, 10),
      goal: 10
    },
    {
      id: "100x_club",
      name: "100x Club",
      description: "Hit a triple-digit compression ratio.",
      earned: has100x
    },
    {
      id: "1kx_club",
      name: "1000x Club",
      description: "Hit a four-figure compression ratio.",
      earned: has1Kx
    },
    {
      id: "million_x_club",
      name: "Million-x Club",
      description: "Hit a seven-figure compression ratio.",
      earned: has1Mx
    },
    {
      id: "streak_3",
      name: "Streak: 3 days",
      description: "Ship three days in a row.",
      earned: longestStreak >= 3,
      progress: Math.min(longestStreak, 3),
      goal: 3
    }
  ];
}

// src/commands/history.ts
function history(args = {}) {
  const shippedSessions = getAllShipped();
  const stats = getStats();
  const achievements = computeAchievements(shippedSessions);
  const ratios = shippedSessions.map((s) => computeRatio(s));
  const finiteRatios = ratios.filter((r) => isFinite(r));
  const bestRatio = finiteRatios.length > 0 ? Math.max(...finiteRatios) : null;
  const avgRatio = finiteRatios.length > 0 ? finiteRatios.reduce((a, b) => a + b, 0) / finiteRatios.length : null;
  if (args.json) {
    console.log(JSON.stringify({
      ok: true,
      stats: {
        ...stats,
        bestRatio,
        avgRatio,
        totalSavedHuman: humanDuration(stats.totalSavedMs),
        totalSavedSpoken: humanDurationSpoken(stats.totalSavedMs)
      },
      achievements,
      shipped: shippedSessions.map((s, i) => ({
        ...s,
        ratio: ratios[i],
        ratio_formatted: formatRatio(ratios[i])
      }))
    }));
    return 0;
  }
  const rows = shippedSessions.map((s, i) => ({
    ...s,
    ratio: ratios[i]
  }));
  console.log(historyTable(rows, { ...stats, bestRatio, avgRatio }, { plain: args.plain, noEmoji: args.noEmoji }));
  const earned = achievements.filter((a) => a.earned);
  const inProgress = achievements.filter((a) => !a.earned && a.progress !== undefined && a.progress > 0);
  if (shippedSessions.length === 0) {
    return 0;
  }
  if (args.plain) {
    console.log("Achievements:");
    if (earned.length === 0) {
      console.log("  Ship your first session to start earning these.");
    } else {
      for (const a of earned) {
        console.log(`  [x] ${a.name}: ${a.description}`);
      }
    }
    if (inProgress.length > 0) {
      console.log(`
  In progress:`);
      for (const a of inProgress) {
        const pct = a.goal && a.progress !== undefined ? `${a.progress}/${a.goal}` : "";
        console.log(`  [ ] ${a.name} (${pct})`);
      }
    }
    console.log("");
    return 0;
  }
  const trophy = args.noEmoji ? "" : "\uD83C\uDFC6 ";
  console.log(c.brightYellow(c.bold(`${trophy}ACHIEVEMENTS`)));
  console.log(c.dim("─".repeat(74)));
  if (earned.length === 0) {
    console.log("  " + c.dim("Ship your first session to start earning these."));
  } else {
    for (const a of earned) {
      console.log(`  ${c.brightGreen("✓")} ${c.bold(a.name)}  ${c.dim(a.description)}`);
    }
  }
  if (inProgress.length > 0) {
    console.log("");
    console.log("  " + c.dim("In progress:"));
    for (const a of inProgress) {
      const pct = a.goal && a.progress !== undefined ? `${a.progress}/${a.goal}` : "—";
      console.log(`  ${c.dim("○")} ${c.dim(a.name)}  ${c.dim(`(${pct})`)}`);
    }
  }
  console.log("");
  return 0;
}

// src/commands/screenshot.ts
import { spawn as spawn3 } from "node:child_process";
import { platform as platform3 } from "node:os";
import { resolve } from "node:path";
function pbcopyPng2(path) {
  if (platform3() !== "darwin")
    return false;
  try {
    const proc = spawn3("osascript", ["-e", `set the clipboard to (read (POSIX file "${path}") as «class PNGf»)`], { stdio: "ignore" });
    return proc.pid !== undefined;
  } catch {
    return false;
  }
}
async function screenshotCmd(args) {
  const session = args.id !== undefined ? getSessionById(args.id) : getMostRecentShipped();
  if (!session) {
    if (args.json) {
      console.error(JSON.stringify({ ok: false, error: "no_shipped_session" }));
    } else {
      console.error((args.plain ? "Error: " : c.brightRed("Error:") + " ") + "no shipped session. Ship one first.");
    }
    return 1;
  }
  if (session.shipped_at === null) {
    if (args.json) {
      console.error(JSON.stringify({ ok: false, error: "session_not_shipped", id: session.id }));
    } else {
      const msg = `session ${session.id} hasn't shipped yet.`;
      console.error((args.plain ? "Error: " : c.brightRed("Error:") + " ") + msg);
    }
    return 1;
  }
  let png;
  try {
    png = await renderShipCard(session);
  } catch (err) {
    const msg = err.message;
    if (args.json) {
      console.error(JSON.stringify({ ok: false, error: "render_failed", details: msg }));
    } else {
      console.error((args.plain ? "Error: " : c.brightRed("Error:") + " ") + "failed to render screenshot: " + msg);
    }
    return 1;
  }
  const outPath = args.out ? resolve(args.out) : defaultScreenshotPath(session.id);
  writeScreenshot(outPath, png);
  const altPath = altTextPath(outPath);
  writeAltText(outPath, altTextForSession(session));
  let copied = false;
  if (args.copy) {
    copied = pbcopyPng2(outPath);
  }
  if (args.json) {
    console.log(JSON.stringify({
      ok: true,
      path: outPath,
      alt_text_path: altPath,
      session_id: session.id,
      bytes: png.length,
      copied_to_clipboard: copied
    }));
  } else if (args.plain) {
    console.log(`Screenshot saved: ${outPath}`);
    console.log(`Alt text:        ${altPath}`);
    console.log(`${png.length} bytes, 1200x630 (Open Graph dimensions).`);
    if (copied)
      console.log("PNG copied to clipboard.");
  } else {
    console.log("");
    console.log(c.dim("Screenshot saved: ") + c.bold(outPath));
    console.log(c.dim("Alt text:        ") + c.dim(altPath));
    console.log(c.dim(`${png.length} bytes, 1200x630 (Open Graph dimensions).`));
    if (copied)
      console.log(c.brightGreen("✓ PNG copied to clipboard — Cmd+V into any compose box."));
    console.log("");
  }
  if (args.open) {
    openFile(outPath);
  }
  return 0;
}
function openFile(path) {
  const cmd = platform3() === "darwin" ? "open" : platform3() === "win32" ? "start" : "xdg-open";
  try {
    spawn3(cmd, [path], { detached: true, stdio: "ignore" }).unref();
  } catch {}
}

// src/commands/watch.ts
import { readFileSync as readFileSync4 } from "node:fs";

// src/parser.ts
import { readFileSync as readFileSync3, existsSync as existsSync3 } from "node:fs";
var UNIT_MS = {
  minute: 60 * 1000,
  hour: 60 * 60 * 1000,
  day: 24 * 60 * 60 * 1000,
  week: 7 * 24 * 60 * 60 * 1000,
  month: 30 * 24 * 60 * 60 * 1000
};
var NUMBER_WORDS = {
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
  twelve: 12
};
function numericValue(raw) {
  const trimmed = raw.trim().toLowerCase();
  if (/^\d+(?:\.\d+)?$/.test(trimmed)) {
    const n = parseFloat(trimmed);
    if (n > 0)
      return n;
    return null;
  }
  return NUMBER_WORDS[trimmed] ?? null;
}
function findEstimates(text) {
  if (!text)
    return [];
  const matches = [];
  const plainRe = /(?:about|around|roughly|approximately|maybe|likely|probably|estimated?|estimate(?:d)?\s+at|takes?|take\s+about|will\s+take|should\s+take)?\s*(\d+(?:\.\d+)?|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|a|an)\s+(minute|hour|day|week|month)s?(?:\s+of\s+(?:focused\s+)?work)?/gi;
  for (const m of text.matchAll(plainRe)) {
    const n = numericValue(m[1]);
    const unit = m[2].toLowerCase();
    if (n === null || !UNIT_MS[unit])
      continue;
    const ms = n * UNIT_MS[unit];
    if (ms <= 0)
      continue;
    const valueText = formatEstimateText(n, unit);
    matches.push({
      text: valueText,
      ms,
      quote: m[0].trim()
    });
  }
  const rangeRe = /(minute|hour|day|week|month)s?\s+\d+\s*(?:-|–|through|to)\s*(\d+)/gi;
  for (const m of text.matchAll(rangeRe)) {
    const unit = m[1].toLowerCase();
    const upper = parseInt(m[2], 10);
    if (!UNIT_MS[unit] || isNaN(upper) || upper <= 0)
      continue;
    const ms = upper * UNIT_MS[unit];
    matches.push({
      text: formatEstimateText(upper, unit),
      ms,
      quote: m[0].trim()
    });
  }
  const byWeekRe = /by\s+(?:the\s+)?(?:end\s+of\s+)?(week|month|day)\s+(\d+)/gi;
  for (const m of text.matchAll(byWeekRe)) {
    const unit = m[1].toLowerCase();
    const n = parseInt(m[2], 10);
    if (!UNIT_MS[unit] || isNaN(n) || n <= 0)
      continue;
    matches.push({
      text: formatEstimateText(n, unit),
      ms: n * UNIT_MS[unit],
      quote: m[0].trim()
    });
  }
  matches.sort((a, b) => b.ms - a.ms);
  return matches;
}
function formatEstimateText(n, unit) {
  const rounded = Math.max(1, Math.round(n));
  return `${rounded} ${unit}${rounded === 1 ? "" : "s"}`;
}
function bestEstimate(text) {
  const all = findEstimates(text);
  return all[0] ?? null;
}
function inferTaskFromUserMessage(message) {
  if (!message)
    return null;
  let t = message.replace(/\s+/g, " ").trim();
  const leaders = [
    /^(?:hi|hey|hello)[\s,.!]+/i,
    /^(?:can|could|would|will)\s+you\s+/i,
    /^(?:please\s+)?help\s+me\s+/i,
    /^please\s+/i,
    /^i\s+(?:want|need|would\s+like)\s+(?:to|you\s+to)\s+/i,
    /^let'?s\s+/i,
    /^we\s+need\s+to\s+/i
  ];
  for (let pass = 0;pass < 3; pass++) {
    for (const re of leaders) {
      const before = t;
      t = t.replace(re, "");
      if (t !== before)
        break;
    }
  }
  t = t.trim().replace(/^[.,;:!?]+/, "").trim();
  if (t.length < 3)
    return null;
  const sentenceEnd = t.search(/[.!?]\s|[\n\r]/);
  if (sentenceEnd > 2)
    t = t.slice(0, sentenceEnd);
  t = t.replace(/[.!?]+\s*$/, "").trim();
  const chars = [...t];
  if (chars.length > 80)
    t = chars.slice(0, 79).join("") + "…";
  return t.trim();
}
function readTranscript(path) {
  const empty = { lastAssistantText: "", lastUserText: "" };
  if (!path || !existsSync3(path))
    return empty;
  let raw;
  try {
    raw = readFileSync3(path, "utf-8");
  } catch {
    return empty;
  }
  const lines = raw.split(`
`).filter((l) => l.trim().length > 0);
  let lastAssistant = "";
  let lastAssistantIndex = -1;
  const events = [];
  for (let i = 0;i < lines.length; i++) {
    const text = extractTextFromLine(lines[i]);
    if (!text)
      continue;
    if (text.role === "assistant") {
      events.push(text);
      lastAssistantIndex = events.length - 1;
    } else if (text.role === "user") {
      events.push(text);
    }
  }
  if (lastAssistantIndex < 0)
    return empty;
  lastAssistant = events[lastAssistantIndex].text;
  let lastUser = "";
  for (let i = lastAssistantIndex - 1;i >= 0; i--) {
    if (events[i].role === "user") {
      lastUser = events[i].text;
      break;
    }
  }
  return { lastAssistantText: lastAssistant, lastUserText: lastUser };
}
function extractTextFromLine(line) {
  let obj;
  try {
    obj = JSON.parse(line);
  } catch {
    return null;
  }
  if (!obj || typeof obj !== "object")
    return null;
  const o = obj;
  const typeField = o.type;
  const role = o.role ?? typeField;
  if (role !== "user" && role !== "assistant")
    return null;
  const message = o.message ?? o;
  const content = message.content;
  let text = "";
  if (typeof content === "string") {
    text = content;
  } else if (Array.isArray(content)) {
    for (const block of content) {
      if (block && typeof block === "object") {
        const b = block;
        if (b.type === "text" && typeof b.text === "string") {
          text += (text ? `
` : "") + b.text;
        } else if (typeof b.text === "string") {
          text += (text ? `
` : "") + b.text;
        }
      } else if (typeof block === "string") {
        text += (text ? `
` : "") + block;
      }
    }
  }
  if (!text)
    return null;
  return { role, text };
}

// src/commands/watch.ts
async function watch(args) {
  let assistantText = "";
  let userText = "";
  if (args.fromHook) {
    const stdinRaw = await readAllStdin();
    let payload = {};
    try {
      payload = JSON.parse(stdinRaw || "{}");
    } catch {}
    if (payload.transcript_path) {
      const t = readTranscript(payload.transcript_path);
      assistantText = t.lastAssistantText;
      userText = t.lastUserText;
    } else if (stdinRaw.trim().length > 0) {
      assistantText = stdinRaw;
    }
  } else if (args.fromPath) {
    if (args.fromPath.endsWith(".jsonl")) {
      const t = readTranscript(args.fromPath);
      assistantText = t.lastAssistantText;
      userText = t.lastUserText;
    } else {
      try {
        assistantText = readFileSync4(args.fromPath, "utf-8");
      } catch (err) {
        return emit({ args, ok: false, error: `cannot read ${args.fromPath}: ${err.message}` });
      }
    }
  } else {
    assistantText = await readAllStdin();
  }
  if (!assistantText || assistantText.trim().length === 0) {
    return emit({ args, ok: false, error: "no_text", message: "Nothing on stdin / transcript was empty." });
  }
  const match = bestEstimate(assistantText);
  if (!match) {
    return emit({ args, ok: false, error: "no_estimate", message: "No estimate phrase found in the text." });
  }
  const existing = getMostRecentActive();
  if (existing) {
    return emit({
      args,
      ok: false,
      error: "active_session_exists",
      message: `Already tracking "${existing.task}". Ship or abandon it first.`,
      existing
    });
  }
  const task = args.task?.trim() || inferTaskFromUserMessage(userText) || "Claude's plan";
  const session = createSession(task, match.text, match.ms, match.quote);
  if (args.json) {
    console.log(JSON.stringify({ ok: true, session, captured: match }));
    return 0;
  }
  if (args.quiet) {
    return 0;
  }
  const verb = args.fromHook ? "Caught" : "Captured";
  console.log("");
  console.log(`${c.brightGreen("\uD83C\uDFAF")} ${c.bold(verb + ":")} ${c.italic('"' + match.quote + '"')}`);
  console.log(`   ${c.dim("Task:")}      ${c.bold(task)}`);
  console.log(`   ${c.dim("Estimate:")}  ${c.brightCyan(match.text)} ${c.dim("(" + Math.round(match.ms / (60 * 60 * 1000)) + "h)")}`);
  console.log("");
  console.log(c.dim("   Run `twoweeks ship` when you're done."));
  console.log("");
  return 0;
}
function emit({ args, ok, error, message, existing }) {
  if (args.json) {
    const payload = { ok };
    if (error)
      payload.error = error;
    if (message)
      payload.message = message;
    if (existing)
      payload.existing = existing;
    console.log(JSON.stringify(payload));
    return ok ? 0 : error === "active_session_exists" ? 0 : 1;
  }
  if (args.quiet) {
    return 0;
  }
  if (!ok && message) {
    console.error(c.dim(message));
  }
  return 0;
}
async function readAllStdin() {
  if (process.stdin.isTTY)
    return "";
  return await new Promise((resolve2) => {
    let data = "";
    process.stdin.setEncoding("utf-8");
    process.stdin.on("data", (chunk) => data += chunk);
    process.stdin.on("end", () => resolve2(data));
    process.stdin.on("error", () => resolve2(data));
  });
}

// src/commands/install-hook.ts
import { readFileSync as readFileSync5, writeFileSync as writeFileSync3, mkdirSync as mkdirSync3, existsSync as existsSync4 } from "node:fs";
import { join as join3, dirname as dirname2 } from "node:path";
import { homedir as homedir3 } from "node:os";
var HOOK_COMMAND = "twoweeks watch --from-hook --quiet";
var HOOK_TAG = "twoweeks-auto-capture";
function settingsPath(scope) {
  if (scope === "user")
    return join3(homedir3(), ".claude", "settings.json");
  return join3(process.cwd(), ".claude", "settings.json");
}
function load2(path) {
  if (!existsSync4(path))
    return {};
  try {
    const raw = readFileSync5(path, "utf-8");
    if (raw.trim().length === 0)
      return {};
    return JSON.parse(raw);
  } catch (err) {
    throw new Error(`Could not parse ${path}: ${err.message}`);
  }
}
function save2(path, data) {
  mkdirSync3(dirname2(path), { recursive: true });
  writeFileSync3(path, JSON.stringify(data, null, 2) + `
`);
}
function installHook(args) {
  const scope = args.scope ?? "user";
  const path = settingsPath(scope);
  const command = args.command ?? HOOK_COMMAND;
  let settings;
  try {
    settings = load2(path);
  } catch (err) {
    const msg = err.message;
    if (args.json)
      console.error(JSON.stringify({ ok: false, error: msg }));
    else
      console.error(c.brightRed("Error:") + " " + msg);
    return 1;
  }
  if (args.uninstall) {
    return doUninstall({ args, scope, path, settings });
  }
  settings.hooks ??= {};
  const stopHooks = settings.hooks.Stop ??= [];
  for (const group of stopHooks) {
    for (const h of group.hooks ?? []) {
      if (h._twoweeks === HOOK_TAG) {
        if (args.json) {
          console.log(JSON.stringify({ ok: true, already_installed: true, path }));
        } else {
          console.log(c.dim("Auto-capture is already installed at ") + path);
        }
        return 0;
      }
    }
  }
  stopHooks.push({
    matcher: "",
    hooks: [
      {
        type: "command",
        command,
        _twoweeks: HOOK_TAG
      }
    ]
  });
  try {
    save2(path, settings);
  } catch (err) {
    const msg = `Could not write ${path}: ${err.message}`;
    if (args.json)
      console.error(JSON.stringify({ ok: false, error: msg }));
    else
      console.error(c.brightRed("Error:") + " " + msg);
    return 1;
  }
  if (args.json) {
    console.log(JSON.stringify({ ok: true, installed: true, path, command }));
    return 0;
  }
  console.log("");
  console.log(`${c.brightGreen("✓")} Auto-capture installed.`);
  console.log(`   ${c.dim("Hook:")}     ${c.bold("Stop")} → ${c.italic(command)}`);
  console.log(`   ${c.dim("Settings:")} ${path}`);
  console.log("");
  console.log(c.dim('Next time Claude says "this should take 2 weeks," twoweeks catches it.'));
  console.log(c.dim("Run `twoweeks ship` when you're done. Or `twoweeks uninstall-hook` to undo."));
  console.log("");
  return 0;
}
function doUninstall({
  args,
  scope: _scope,
  path,
  settings
}) {
  if (!settings.hooks?.Stop) {
    if (args.json)
      console.log(JSON.stringify({ ok: true, removed: false, path }));
    else
      console.log(c.dim("No twoweeks hook found at ") + path);
    return 0;
  }
  let removed = 0;
  const newGroups = [];
  for (const group of settings.hooks.Stop) {
    const keep = [];
    for (const h of group.hooks ?? []) {
      if (h._twoweeks === HOOK_TAG) {
        removed++;
      } else {
        keep.push(h);
      }
    }
    if (keep.length > 0)
      newGroups.push({ ...group, hooks: keep });
  }
  settings.hooks.Stop = newGroups;
  if (newGroups.length === 0)
    delete settings.hooks.Stop;
  try {
    save2(path, settings);
  } catch (err) {
    const msg = `Could not write ${path}: ${err.message}`;
    if (args.json)
      console.error(JSON.stringify({ ok: false, error: msg }));
    else
      console.error(c.brightRed("Error:") + " " + msg);
    return 1;
  }
  if (args.json) {
    console.log(JSON.stringify({ ok: true, removed: removed > 0, count: removed, path }));
    return 0;
  }
  if (removed > 0) {
    console.log(`${c.brightGreen("✓")} Removed ${removed} twoweeks hook${removed === 1 ? "" : "s"} from ${path}.`);
  } else {
    console.log(c.dim("No twoweeks hook found at ") + path);
  }
  return 0;
}

// src/cli.ts
var VERSION = "0.7.2";
var HELP = `
${c.brightGreen(c.bold("twoweeks"))} ${c.dim(`v${VERSION}`)}

${c.italic("Capture your AI's confident estimate. Time the gap. Brag.")}

${c.bold("Usage:")}
  ${c.bold('twoweeks "task" "<eta>"')}         Start a timer with the AI's stated estimate  ${c.dim("(required)")}
  ${c.bold("twoweeks")}                        Show all active sessions + flair
  ${c.bold("twoweeks status")}                 Same as bare command
  ${c.bold("twoweeks ship")}                   Ship the most recent active session
  ${c.bold("twoweeks ship --share")}           Ship and open X with brag pre-filled
  ${c.bold("twoweeks ship --screenshot")}      Ship and save a 1200x630 PNG brag card
  ${c.bold("twoweeks screenshot [id]")}        Render a PNG for a shipped session
  ${c.bold("twoweeks share [id]")}             Open X intent (default: most recent shipped)
  ${c.bold("twoweeks history")}                Show shipped sessions + lifetime stats + achievements
  ${c.bold("twoweeks abandon")}                Abandon the most recent active session
  ${c.bold("twoweeks install-hook")}           Auto-capture Claude's estimates in Claude Code  ${c.dim("(zero invocation)")}
  ${c.bold("twoweeks uninstall-hook")}         Remove the Claude Code auto-capture hook
  ${c.bold("twoweeks watch")}                  Read text from stdin, capture an estimate if found

${c.bold("Examples:")}
  ${c.dim("# AI said it'd take 2 weeks. You actually shipped in 47 minutes.")}
  ${c.bold('$ twoweeks "build the auth flow" "2 weeks"')}
  ${c.bold("$ twoweeks ship --screenshot --copy")}
  ${c.dim("# Compression: 428x faster than the AI thought (and the PNG is on your clipboard)")}

  ${c.dim("# Or zero-touch: install the Claude Code hook and forget about it.")}
  ${c.bold("$ twoweeks install-hook")}
  ${c.dim('# Next time Claude says "about 2 weeks of focused work," twoweeks catches it.')}

${c.bold("Flags:")}
  ${c.bold('--eta "<duration>"')}              AI estimate via flag instead of second positional
  ${c.bold('--quote "<text>"')}                Verbatim AI quote (rendered on the brag card)
  ${c.bold("--force")}                         Start a new session even if one is already active
  ${c.bold("--to-bluesky")}                    Share to Bluesky instead of X
  ${c.bold("--to-mastodon")}                   Share to Mastodon instead of X
  ${c.bold("--print")}                         Print the share URL instead of opening
  ${c.bold("--screenshot")}                    (on ship) Save a PNG of the brag card
  ${c.bold("--copy")}                          (on ship/screenshot, macOS) Copy the PNG to clipboard
  ${c.bold("--out <path>")}                    Output path for screenshot command
  ${c.bold("--open")}                          (on screenshot) Open the PNG after saving
  ${c.bold("--plain")}                         Plain text (no colors / box drawing / emoji)
  ${c.bold("--no-color")}                      Disable ANSI colors (also set ${c.italic("NO_COLOR=1")})
  ${c.bold("--no-emoji")}                      Strip emoji (also set ${c.italic("TWOWEEKS_NO_EMOJI=1")})
  ${c.bold("--json")}                          Machine-readable JSON output
  ${c.bold("--help, -h")}                      Show this help
  ${c.bold("--version, -v")}                   Show version

${c.bold("Storage:")}
  ${c.dim("~/.twoweeks/history.json")}        ${c.dim("local JSON, no telemetry, no cloud")}
  ${c.dim("~/.twoweeks/screenshots/")}        ${c.dim("PNG brag cards (with .alt.txt sidecars)")}
  ${c.dim("$TWOWEEKS_HOME")}                  ${c.dim("override storage directory")}
  ${c.dim("$TWOWEEKS_NO_EMOJI")}              ${c.dim("=1 strips emoji from output")}
  ${c.dim("$TWOWEEKS_DEBUG")}                 ${c.dim("=1 prints stack on unexpected errors")}
`;
function parseArgs(argv) {
  const args = {};
  const positional = [];
  if (process.env.TWOWEEKS_NO_EMOJI && process.env.TWOWEEKS_NO_EMOJI !== "0" && process.env.TWOWEEKS_NO_EMOJI.toLowerCase() !== "false") {
    args.noEmoji = true;
  }
  for (let i = 0;i < argv.length; i++) {
    const a = argv[i];
    if (a === "--help" || a === "-h")
      args.help = true;
    else if (a === "--version" || a === "-v")
      args.version = true;
    else if (a === "--share")
      args.share = true;
    else if (a === "--force")
      args.force = true;
    else if (a === "--print")
      args.print = true;
    else if (a === "--json")
      args.json = true;
    else if (a === "--screenshot")
      args.screenshot = true;
    else if (a === "--open")
      args.open = true;
    else if (a === "--copy")
      args.copy = true;
    else if (a === "--quiet")
      args.quiet = true;
    else if (a === "--from-hook")
      args.fromHook = true;
    else if (a === "--project")
      args.scope = "project";
    else if (a === "--user")
      args.scope = "user";
    else if (a === "--plain") {
      args.plain = true;
      process.env.NO_COLOR = "1";
      args.noEmoji = true;
    } else if (a === "--no-emoji")
      args.noEmoji = true;
    else if (a === "--to-bluesky")
      args.shareTarget = "bluesky";
    else if (a === "--to-mastodon")
      args.shareTarget = "mastodon";
    else if (a === "--to-x" || a === "--to-twitter")
      args.shareTarget = "x";
    else if (a === "--no-color") {
      process.env.NO_COLOR = "1";
    } else if (a === "--eta") {
      args.eta = argv[i + 1];
      i++;
    } else if (a.startsWith("--eta=")) {
      args.eta = a.slice("--eta=".length);
    } else if (a === "--quote") {
      args.quote = argv[i + 1];
      i++;
    } else if (a.startsWith("--quote=")) {
      args.quote = a.slice("--quote=".length);
    } else if (a === "--challenge") {
      args.challenge = argv[i + 1];
      i++;
    } else if (a.startsWith("--challenge=")) {
      args.challenge = a.slice("--challenge=".length);
    } else if (a === "--out") {
      args.out = argv[i + 1];
      i++;
    } else if (a.startsWith("--out=")) {
      args.out = a.slice("--out=".length);
    } else if (a === "--from") {
      args.from = argv[i + 1];
      i++;
    } else if (a.startsWith("--from=")) {
      args.from = a.slice("--from=".length);
    } else if (a === "--task") {
      args.task = argv[i + 1];
      i++;
    } else if (a.startsWith("--task=")) {
      args.task = a.slice("--task=".length);
    } else {
      positional.push(a);
    }
  }
  return { args, positional };
}
var KNOWN_COMMANDS = new Set([
  "status",
  "ship",
  "screenshot",
  "share",
  "abandon",
  "history",
  "board",
  "watch",
  "install-hook",
  "uninstall-hook"
]);
function isTruthy(value) {
  if (value === undefined || value === "")
    return false;
  const v = value.toLowerCase();
  return v !== "0" && v !== "false" && v !== "no" && v !== "off";
}
async function main() {
  const { args, positional } = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(HELP);
    return 0;
  }
  if (args.version) {
    console.log(`twoweeks v${VERSION}`);
    return 0;
  }
  const command = positional[0];
  if (!command || command === "status") {
    return status({ json: !!args.json, plain: !!args.plain, noEmoji: !!args.noEmoji });
  }
  if (command === "ship") {
    return await ship({
      share: !!args.share,
      shareTarget: args.shareTarget,
      screenshot: !!args.screenshot,
      screenshotOut: args.out,
      copy: !!args.copy,
      plain: !!args.plain,
      noEmoji: !!args.noEmoji,
      json: !!args.json
    });
  }
  if (command === "screenshot") {
    let id;
    if (positional[1] !== undefined) {
      id = parseInt(positional[1], 10);
      if (isNaN(id)) {
        console.error(c.brightRed("Error:") + ` invalid session id: ${positional[1]}`);
        return 1;
      }
    }
    return await screenshotCmd({
      id,
      out: args.out,
      open: !!args.open,
      copy: !!args.copy,
      plain: !!args.plain,
      json: !!args.json
    });
  }
  if (command === "share") {
    let id;
    if (positional[1] !== undefined) {
      id = parseInt(positional[1], 10);
      if (isNaN(id)) {
        console.error(c.brightRed("Error:") + ` invalid session id: ${positional[1]}`);
        return 1;
      }
    }
    return share({
      id,
      target: args.shareTarget,
      print: args.print,
      challenge: args.challenge,
      json: !!args.json
    });
  }
  if (command === "abandon") {
    return abandon({ json: !!args.json, plain: !!args.plain });
  }
  if (command === "history" || command === "board") {
    return history({ json: !!args.json, plain: !!args.plain, noEmoji: !!args.noEmoji });
  }
  if (command === "watch") {
    return await watch({
      fromPath: args.from,
      fromHook: !!args.fromHook,
      task: args.task,
      quiet: !!args.quiet,
      json: !!args.json,
      plain: !!args.plain
    });
  }
  if (command === "install-hook") {
    return installHook({ scope: args.scope, json: !!args.json });
  }
  if (command === "uninstall-hook") {
    return installHook({ uninstall: true, scope: args.scope, json: !!args.json });
  }
  const task = command;
  let etaInput = args.eta;
  if (!etaInput && positional[1] && !KNOWN_COMMANDS.has(positional[1])) {
    etaInput = positional[1];
  }
  return start({
    task,
    eta: etaInput,
    quote: args.quote,
    force: !!args.force,
    plain: !!args.plain,
    noEmoji: !!args.noEmoji,
    json: !!args.json
  });
}
main().then((code) => process.exit(code)).catch((err) => {
  const e = err;
  if (process.argv.includes("--json")) {
    console.error(JSON.stringify({ ok: false, error: e.message }));
  } else {
    console.error(c.brightRed("Unexpected error:") + " " + e.message);
    if (isTruthy(process.env.TWOWEEKS_DEBUG)) {
      console.error(e.stack);
    } else {
      console.error(c.dim("(set TWOWEEKS_DEBUG=1 for full stack trace)"));
    }
  }
  process.exit(1);
});
export {
  parseArgs
};
