import { getMostRecentActive, shipSession } from "../db.ts";
import { resultCard, computeRatio, formatRatio, humanDuration } from "../format.ts";
import { milestoneFor } from "../flair.ts";
import { buildShareUrl, openUrl } from "./share.ts";
import type { ShareTarget } from "./share.ts";
import { c } from "../colors.ts";

export interface ShipArgs {
  share?: boolean;
  shareTarget?: ShareTarget;
  json?: boolean;
}

export function ship(args: ShipArgs): number {
  const active = getMostRecentActive();
  if (!active) {
    if (args.json) {
      console.error(JSON.stringify({ ok: false, error: "no_active_session" }));
    } else {
      console.error(c.brightRed("Error:") + ' no active session to ship. Start one with: ' + c.bold('twoweeks "task"'));
    }
    return 1;
  }
  const shipped = shipSession(active.id);
  if (!shipped || shipped.shipped_at === null) {
    if (args.json) {
      console.error(JSON.stringify({ ok: false, error: "ship_failed" }));
    } else {
      console.error(c.brightRed("Error:") + " failed to ship session.");
    }
    return 1;
  }

  const ratio = computeRatio(shipped);
  const milestone = milestoneFor(ratio);
  const target: ShareTarget = args.shareTarget ?? "x";
  const url = buildShareUrl(shipped, target);

  if (args.json) {
    const actualMs = (shipped.shipped_at as number) - shipped.started_at;
    console.log(
      JSON.stringify({
        ok: true,
        session: shipped,
        ratio,
        ratio_formatted: formatRatio(ratio),
        actual_ms: actualMs,
        actual_human: humanDuration(actualMs),
        saved_ms: Math.max(0, shipped.eta_ms - actualMs),
        milestone,
        share_url: url,
        share_target: target,
      })
    );
    if (args.share) openUrl(url);
    return 0;
  }

  console.log(resultCard(shipped, milestone));

  if (args.share) {
    const targetName = target === "x" ? "X" : target === "bluesky" ? "Bluesky" : "Mastodon";
    console.log(c.dim(`Opening ${targetName} with your brag pre-filled...`));
    console.log("");
    console.log(c.dim("If your browser doesn't open, here's the URL:"));
    console.log(c.cyan(url));
    console.log("");
    openUrl(url);
  } else {
    console.log(c.dim("Want to brag? Run: ") + c.bold(`twoweeks share ${shipped.id}`));
    console.log("");
  }
  return 0;
}
