import { getMostRecentActive, abandonSession } from "../db.ts";
import { c } from "../colors.ts";

export interface AbandonArgs {
  json?: boolean;
  plain?: boolean;
}

export function abandon(args: AbandonArgs = {}): number {
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
  console.log(c.brightYellow("🏳️") + "  " + c.dim("Abandoned: ") + c.bold(active.task));
  console.log(c.dim("   (Excluded from stats. No shame; start a new one any time.)"));
  console.log("");
  return 0;
}
