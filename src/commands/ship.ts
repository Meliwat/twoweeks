import { getMostRecentActive, shipSession } from "../db.ts";
import { resultCard } from "../format.ts";
import { buildShareUrl, openUrl } from "./share.ts";

export interface ShipArgs {
  share?: boolean;
}

export function ship(args: ShipArgs): number {
  const active = getMostRecentActive();
  if (!active) {
    console.error('No active session to ship. Start one with: twoweeks "task"');
    return 1;
  }
  const shipped = shipSession(active.id);
  if (!shipped) {
    console.error("Failed to ship session.");
    return 1;
  }
  console.log(resultCard(shipped));

  const url = buildShareUrl(shipped);
  if (args.share) {
    console.log("Opening X with your brag pre-filled...");
    console.log("");
    console.log(`If your browser doesn't open, here's the URL:`);
    console.log(url);
    console.log("");
    openUrl(url);
  } else {
    console.log(`Want to brag? Run: twoweeks share ${shipped.id}`);
    console.log("");
  }
  return 0;
}
