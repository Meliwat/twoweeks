import { getSessionById, getMostRecentShipped } from "../db.ts";
import { humanDuration, computeRatio, formatRatio } from "../format.ts";
import type { Session } from "../db.ts";
import { spawn } from "node:child_process";
import { platform } from "node:os";
import { c } from "../colors.ts";

export type ShareTarget = "x" | "bluesky" | "mastodon";

const REPO_URL = "https://github.com/Meliwat/twoweeks";

function shareText(session: Session): string {
  if (session.shipped_at === null || session.shipped_at === undefined) {
    throw new Error("Cannot share unshipped session");
  }
  const actualMs = session.shipped_at - session.started_at;
  const ratio = computeRatio(session);
  const duration = humanDuration(actualMs);
  const ratioText = formatRatio(ratio);

  return `I beat my AI's "${session.eta_text}" estimate by ${ratioText}.\n\nActual ship time: ${duration}.\n\ntwoweeks ⚙️ ${REPO_URL}`;
}

export function buildShareUrl(session: Session, target: ShareTarget = "x"): string {
  const text = shareText(session);
  switch (target) {
    case "x":
      return `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
    case "bluesky":
      return `https://bsky.app/intent/compose?text=${encodeURIComponent(text)}`;
    case "mastodon":
      return `https://toot.kytta.dev/?text=${encodeURIComponent(text)}`;
  }
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
  target?: ShareTarget;
  print?: boolean;
  json?: boolean;
}

export function share(args: ShareArgs): number {
  const session =
    args.id !== undefined ? getSessionById(args.id) : getMostRecentShipped();
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
  const target: ShareTarget = args.target ?? "x";
  const url = buildShareUrl(session, target);

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
