import type { Session } from "./db.ts";
import { c } from "./colors.ts";

const MAX_TASK_DISPLAY = 60;

// Truncate by code points (handles emoji and CJK better than .slice on UTF-16
// code units). Full grapheme awareness would need Intl.Segmenter; this is the
// 90% fix.
function truncateTask(task: string): string {
  const chars = [...task];
  if (chars.length <= MAX_TASK_DISPLAY) return task;
  return chars.slice(0, MAX_TASK_DISPLAY - 1).join("") + "…";
}

export function humanDuration(ms: number): string {
  const abs = Math.max(0, Math.floor(ms));
  if (abs < 1000) {
    return `${abs}ms`;
  }
  const days = Math.floor(abs / (24 * 60 * 60 * 1000));
  const hours = Math.floor((abs % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
  const minutes = Math.floor((abs % (60 * 60 * 1000)) / (60 * 1000));
  const seconds = Math.floor((abs % (60 * 1000)) / 1000);

  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (seconds > 0 && days === 0) parts.push(`${seconds}s`);
  return parts.join(" ") || "0s";
}

/**
 * Spoken duration for screen readers and the --json output:
 * "47 minutes 12 seconds" instead of "47m 12s".
 */
export function humanDurationSpoken(ms: number): string {
  const abs = Math.max(0, Math.floor(ms));
  if (abs < 1000) return `${abs} milliseconds`;
  const days = Math.floor(abs / (24 * 60 * 60 * 1000));
  const hours = Math.floor((abs % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
  const minutes = Math.floor((abs % (60 * 60 * 1000)) / (60 * 1000));
  const seconds = Math.floor((abs % (60 * 1000)) / 1000);
  const parts: string[] = [];
  if (days > 0) parts.push(`${days} ${days === 1 ? "day" : "days"}`);
  if (hours > 0) parts.push(`${hours} ${hours === 1 ? "hour" : "hours"}`);
  if (minutes > 0) parts.push(`${minutes} ${minutes === 1 ? "minute" : "minutes"}`);
  if (seconds > 0 && days === 0) parts.push(`${seconds} ${seconds === 1 ? "second" : "seconds"}`);
  return parts.join(" ") || "zero seconds";
}

export function compactRemaining(session: Session): string {
  const remaining = session.started_at + session.eta_ms - Date.now();
  if (remaining <= 0) {
    return c.brightYellow("0s") + c.dim(" (your AI was overconfident, somehow)");
  }
  return c.brightCyan(humanDuration(remaining));
}

/**
 * Compression ratio as a float (eta / actual). Caller chooses precision via formatRatio.
 */
export function computeRatio(session: Session): number {
  if (session.shipped_at === null || session.shipped_at === undefined) {
    throw new Error("Session not shipped");
  }
  const actualMs = session.shipped_at - session.started_at;
  if (actualMs <= 0) return Infinity;
  return session.eta_ms / actualMs;
}

export function formatRatio(ratio: number): string {
  if (!isFinite(ratio)) return "∞x";
  if (ratio >= 1_000_000) return `${(ratio / 1_000_000).toFixed(1)}Mx`;
  if (ratio >= 1_000) return `${(ratio / 1000).toFixed(1)}Kx`;
  if (ratio >= 10) return `${Math.round(ratio)}x`;
  if (ratio >= 1) return `${ratio.toFixed(2)}x`;
  return `${ratio.toFixed(3)}x`;
}

export interface CardOptions {
  plain?: boolean;
  noEmoji?: boolean;
}

function maybeEmoji(s: string, opts: CardOptions): string {
  if (opts.plain || opts.noEmoji) return s.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2300}-\u{23FF}]/gu, "").trim();
  return s;
}

export function resultCard(
  session: Session,
  milestone?: string,
  opts: CardOptions = {}
): string {
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
    // Screen-reader / dumb-terminal friendly: no colors, no box drawing, no emoji.
    const verdict = overBudget ? "Cost" : "Saved";
    const sign = overBudget ? "-" : "+";
    const lines = [
      "Shipped.",
      `Task: ${task}`,
      `Estimated: ${session.eta_text}`,
      `Actual: ${humanDurationSpoken(actualMs)}`,
      `Compression: ${ratioText} ${overBudget ? "of the AI's estimate (slower than predicted)" : "faster than the AI thought"}`,
      `${verdict}: ${sign}${humanDurationSpoken(savedDelta)}`,
    ];
    if (milestone) lines.push("Note: " + maybeEmoji(milestone, opts));
    return lines.join("\n") + "\n";
  }

  const rule = c.dim("──────────────────────────────────────────");
  const label = (s: string) => c.dim(s);
  const verdictLabel = overBudget ? "Cost:" : "Saved:";
  const sign = overBudget ? "-" : "+";
  const verdictColor = overBudget ? c.red : c.green;
  const ratioColor = isFinite(ratio) ? c.brightGreen : c.brightCyan;

  const shippedHeader = opts.noEmoji
    ? c.brightGreen(c.bold("SHIPPED"))
    : c.brightGreen(c.bold("🎯 SHIPPED"));

  const lines = [
    "",
    shippedHeader,
    rule,
    `${label("Task:")}        ${c.bold(task)}`,
    `${label("Estimated:")}   ${c.italic(session.eta_text)}`,
    `${label("Actual:")}      ${c.brightYellow(humanDuration(actualMs))}`,
    `${label("Compression:")} ${ratioColor(c.bold(ratioText))} ${c.dim(overBudget ? "(the AI, against all odds, was right)" : "faster than the AI thought")}`,
    `${label(verdictLabel + "      ")} ${verdictColor(sign + humanDuration(savedDelta))}`,
    rule,
  ];
  if (milestone) {
    lines.push("");
    lines.push(c.brightYellow(c.bold(maybeEmoji(milestone, opts))));
  }
  lines.push("");
  return lines.join("\n");
}

export function statusCard(
  session: Session,
  flair: string,
  opts: CardOptions = {}
): string {
  const task = truncateTask(session.task);
  if (opts.plain) {
    const remaining = session.started_at + session.eta_ms - Date.now();
    const remainingText = remaining > 0 ? humanDurationSpoken(remaining) : "zero seconds (overdue)";
    return `Active: ${task}. Time remaining: ${remainingText}. ${flair}\n`;
  }
  const clock = opts.noEmoji ? "[active]" : "⏰";
  const lines = [
    "",
    `${c.brightCyan(clock)} ${compactRemaining(session)} ${c.dim("remaining for:")} ${c.bold(task)}`,
    `   ${c.dim(c.italic(flair))}`,
    "",
  ];
  return lines.join("\n");
}

export function startCard(
  session: Session,
  flair: string,
  opts: CardOptions = {}
): string {
  const task = truncateTask(session.task);
  if (opts.plain) {
    return `Started timer: ${task}. Estimate: ${session.eta_text}. ${flair} Run 'twoweeks ship' when done.\n`;
  }
  const clock = opts.noEmoji ? "[active]" : "⏰";
  const lines = [
    "",
    `${c.brightCyan(clock)} ${c.brightCyan(session.eta_text)} ${c.dim("remaining for:")} ${c.bold(task)}`,
    `   ${c.dim(c.italic(flair))}`,
    "",
    `   ${c.dim("(run `twoweeks ship` when you're done)")}`,
    "",
  ];
  return lines.join("\n");
}

export interface HistoryStats {
  total: number;
  shipped: number;
  abandoned: number;
  bestRatio: number | null;
  avgRatio: number | null;
  totalSavedMs: number;
}

export function historyTable(
  shipped: Array<Session & { ratio: number }>,
  stats: HistoryStats,
  opts: CardOptions = {}
): string {
  if (opts.plain) {
    if (shipped.length === 0) return "No shipped sessions yet.\n";
    const rows = shipped.slice(0, 10).map((s) => {
      const actualMs = (s.shipped_at as number) - s.started_at;
      return `  ${s.id}. ${truncateTask(s.task)} — estimated ${s.eta_text}, actual ${humanDurationSpoken(actualMs)}, ratio ${formatRatio(s.ratio)}`;
    });
    const summary = [
      `Total shipped: ${stats.shipped}.`,
      `Best compression: ${stats.bestRatio !== null ? formatRatio(stats.bestRatio) : "none"}.`,
      `Average compression: ${stats.avgRatio !== null ? formatRatio(stats.avgRatio) : "none"}.`,
      `Lifetime time saved: ${humanDurationSpoken(stats.totalSavedMs)}.`,
    ];
    if (stats.abandoned > 0) summary.push(`Abandoned: ${stats.abandoned}.`);
    return ["Shipped sessions:", ...rows, "", ...summary].join("\n") + "\n";
  }

  if (shipped.length === 0) {
    return [
      "",
      c.dim("No shipped sessions yet. Ship one and the brag accumulates here."),
      "",
    ].join("\n");
  }

  const rule = c.dim("─".repeat(74));
  const header =
    c.bold(c.dim("  id   ")) +
    c.bold(c.dim("ratio    ")) +
    c.bold(c.dim("actual       ")) +
    c.bold(c.dim("task"));

  const rows = shipped.slice(0, 10).map((s) => {
    const actualMs = (s.shipped_at as number) - s.started_at;
    const id = String(s.id).padEnd(5);
    const ratio = formatRatio(s.ratio).padEnd(8);
    const actual = humanDuration(actualMs).padEnd(12);
    const task = truncateTask(s.task);
    return `  ${c.dim(id)} ${c.brightGreen(ratio)} ${c.brightYellow(actual)} ${task}`;
  });

  const header_icon = opts.noEmoji ? "" : "📜 ";
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
    `  ${c.dim("Lifetime saved:")}   ${c.green(humanDuration(stats.totalSavedMs))}`,
  ];
  if (stats.abandoned > 0) {
    lines.push(`  ${c.dim(`Abandoned:        ${stats.abandoned}`)}`);
  }
  lines.push("");
  return lines.join("\n");
}
