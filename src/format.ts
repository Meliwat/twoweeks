import type { Session } from "./db.ts";
import { c } from "./colors.ts";

const MAX_TASK_DISPLAY = 60;

function truncateTask(task: string): string {
  if (task.length <= MAX_TASK_DISPLAY) return task;
  return task.slice(0, MAX_TASK_DISPLAY - 1) + "…";
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

export function resultCard(session: Session, milestone?: string): string {
  if (session.shipped_at === null || session.shipped_at === undefined) {
    throw new Error("Session not shipped");
  }
  const actualMs = session.shipped_at - session.started_at;
  const ratio = computeRatio(session);
  const saved = Math.max(0, session.eta_ms - actualMs);
  const ratioText = formatRatio(ratio);
  const task = truncateTask(session.task);

  const rule = c.dim("──────────────────────────────────────────");
  const label = (s: string) => c.dim(s);
  const lines = [
    "",
    c.brightGreen(c.bold("🎯 SHIPPED")),
    rule,
    `${label("Task:")}        ${c.bold(task)}`,
    `${label("Estimated:")}   ${c.italic(session.eta_text)}`,
    `${label("Actual:")}      ${c.brightYellow(humanDuration(actualMs))}`,
    `${label("Compression:")} ${c.brightGreen(c.bold(ratioText))} ${c.dim(ratio >= 1 ? "faster than the AI thought" : "(the AI, against all odds, was right)")}`,
    `${label(saved > 0 ? "Saved:" : "Cost:")}       ${saved > 0 ? c.green(humanDuration(saved)) : c.red(humanDuration(actualMs - session.eta_ms))}`,
    rule,
  ];
  if (milestone) {
    lines.push("");
    lines.push(c.brightYellow(c.bold(milestone)));
  }
  lines.push("");
  return lines.join("\n");
}

export function statusCard(session: Session, flair: string): string {
  const task = truncateTask(session.task);
  const lines = [
    "",
    `${c.brightCyan("⏰")} ${compactRemaining(session)} ${c.dim("remaining for:")} ${c.bold(task)}`,
    `   ${c.dim(c.italic(flair))}`,
    "",
  ];
  return lines.join("\n");
}

export function startCard(session: Session, flair: string): string {
  const task = truncateTask(session.task);
  const lines = [
    "",
    `${c.brightCyan("⏰")} ${c.brightCyan(session.eta_text)} ${c.dim("remaining for:")} ${c.bold(task)}`,
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
  stats: HistoryStats
): string {
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

  const lines = [
    "",
    c.brightGreen(c.bold("📜 SHIPPED SESSIONS")),
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
