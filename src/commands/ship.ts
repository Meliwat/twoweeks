import { getMostRecentActive, shipSession } from "../db.ts";
import { resultCard, computeRatio } from "../format.ts";
import { milestoneFor } from "../flair.ts";
import { buildShareUrl, openUrl } from "./share.ts";
import type { ShareTarget } from "./share.ts";
import { c } from "../colors.ts";

export interface ShipArgs {
  share?: boolean;
  shareTarget?: ShareTarget;
}

export function ship(args: ShipArgs): number {
  const active = getMostRecentActive();
  if (!active) {
    console.error(c.brightRed("Error:") + ' no active session to ship. Start one with: ' + c.bold('twoweeks "task"'));
    return 1;
  }
  const shipped = shipSession(active.id);
  if (!shipped) {
    console.error(c.brightRed("Error:") + " failed to ship session.");
    return 1;
  }

  const ratio = computeRatio(shipped);
  const milestone = milestoneFor(ratio);
  console.log(resultCard(shipped, milestone));

  const target: ShareTarget = args.shareTarget ?? "x";
  const url = buildShareUrl(shipped, target);
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
