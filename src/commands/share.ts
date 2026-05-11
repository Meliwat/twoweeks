import { getSessionById, getMostRecentShipped } from "../db.ts";
import { humanDuration, computeRatio, formatRatio } from "../format.ts";
import type { Session } from "../db.ts";
import { spawn } from "node:child_process";
import { platform } from "node:os";
import { c } from "../colors.ts";

export type ShareTarget = "x" | "bluesky" | "mastodon";

const REPO_URL = "https://github.com/Meliwat/twoweeks";

// Five share-text variants. Algorithms downrank near-duplicate text, so
// randomize per share. Each variant keeps the receipts (eta, actual, ratio) and
// a link to the repo so the brag is recruiting.
const SHARE_VARIANTS: Array<(args: { eta: string; ratio: string; duration: string; quote?: string; challenge?: string }) => string> = [
  ({ eta, ratio, duration, quote }) =>
    `My AI said "${eta}". I shipped in ${duration}.\n\nCompression: ${ratio}.${quote ? `\n\nThe AI's exact words: "${quote}"` : ""}\n\ntwoweeks ⚙️ ${REPO_URL}`,
  ({ eta, ratio, duration }) =>
    `I beat my AI's "${eta}" estimate by ${ratio}.\n\nActual ship time: ${duration}.\n\ntwoweeks ⚙️ ${REPO_URL}`,
  ({ eta, ratio, duration }) =>
    `AI: "About ${eta} of focused work."\nMe: ${duration}.\n\n${ratio} faster than predicted.\n\n${REPO_URL}`,
  ({ eta, ratio, duration }) =>
    `${ratio} compression on today's ship.\n\nThe AI quoted ${eta}. I quoted ${duration}.\n\n${REPO_URL}`,
  ({ eta, ratio, duration, challenge }) =>
    `Just beat my AI's "${eta}" estimate by ${ratio} (shipped in ${duration}).${challenge ? `\n\n${challenge} bet you can't top this.` : ""}\n\n${REPO_URL}`,
];

function pickShareVariant(session: Session, options: { challenge?: string } = {}): string {
  if (!session.shipped_at) throw new Error("Cannot share unshipped session");
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
    challenge: options.challenge,
  });
}

export function buildShareUrl(
  session: Session,
  target: ShareTarget = "x",
  options: { challenge?: string } = {}
): string {
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

export function openUrl(url: string): void {
  const cmd =
    platform() === "darwin" ? "open" : platform() === "win32" ? "start" : "xdg-open";
  try {
    spawn(cmd, [url], { detached: true, stdio: "ignore" }).unref();
  } catch {}
}

export interface ShareArgs {
  id?: number;
  target?: ShareTarget;
  print?: boolean;
  challenge?: string;
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
