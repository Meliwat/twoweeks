import type { Session } from "./db.ts";

export function humanDuration(ms: number): string {
  const abs = Math.max(0, Math.floor(ms));
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
    return "0s (your AI was overconfident, somehow)";
  }
  return humanDuration(remaining);
}

export function computeRatio(session: Session): number {
  if (!session.shipped_at) throw new Error("Session not shipped");
  const actualMs = session.shipped_at - session.started_at;
  if (actualMs <= 0) return Infinity;
  return Math.round(session.eta_ms / actualMs);
}

export function resultCard(session: Session): string {
  if (!session.shipped_at) throw new Error("Session not shipped");
  const actualMs = session.shipped_at - session.started_at;
  const ratio = computeRatio(session);
  const saved = session.eta_ms - actualMs;
  const ratioText = isFinite(ratio) ? `${ratio}x` : "∞x";
  const lines = [
    "",
    "🎯 SHIPPED",
    "──────────────────────────────────────────",
    `Task:        ${session.task}`,
    `Estimated:   ${session.eta_text}`,
    `Actual:      ${humanDuration(actualMs)}`,
    `Compression: ${ratioText} faster than the AI thought`,
    `Saved:       ${humanDuration(saved)}`,
    "──────────────────────────────────────────",
    "",
  ];
  return lines.join("\n");
}

export function statusCard(session: Session, flair: string): string {
  const lines = [
    "",
    `⏰ ${compactRemaining(session)} remaining for: ${session.task}`,
    `   ${flair}`,
    "",
  ];
  return lines.join("\n");
}
