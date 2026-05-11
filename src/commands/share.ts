import { getSessionById, getMostRecentShipped } from "../db.ts";
import { humanDuration, computeRatio } from "../format.ts";
import type { Session } from "../db.ts";
import { spawn } from "node:child_process";
import { platform } from "node:os";

export function buildShareUrl(session: Session): string {
  if (!session.shipped_at) throw new Error("Cannot share unshipped session");
  const actualMs = session.shipped_at - session.started_at;
  const ratio = computeRatio(session);
  const duration = humanDuration(actualMs);
  const ratioText = isFinite(ratio) ? `${ratio}x` : "∞x";

  const text = `I beat my AI's "${session.eta_text}" estimate by ${ratioText}.\n\nActual ship time: ${duration}.\n\ntwoweeks ⚙️ github.com/meliwat/twoweeks`;

  return `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
}

export function openUrl(url: string): void {
  const cmd =
    platform() === "darwin" ? "open" : platform() === "win32" ? "start" : "xdg-open";
  try {
    spawn(cmd, [url], { detached: true, stdio: "ignore" }).unref();
  } catch {
    // Fail silently; URL was printed already
  }
}

export interface ShareArgs {
  id?: number;
}

export function share(args: ShareArgs): number {
  const session =
    args.id !== undefined ? getSessionById(args.id) : getMostRecentShipped();
  if (!session) {
    console.error("No shipped session to share. Ship one first with: twoweeks ship");
    return 1;
  }
  if (!session.shipped_at) {
    console.error(`Session ${session.id} ("${session.task}") hasn't shipped yet.`);
    return 1;
  }
  const url = buildShareUrl(session);
  console.log("");
  console.log("Opening X with your brag pre-filled...");
  console.log("");
  console.log(`If your browser doesn't open, here's the URL:`);
  console.log(url);
  console.log("");
  openUrl(url);
  return 0;
}
