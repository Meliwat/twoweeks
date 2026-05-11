import { getMostRecentActive, abandonSession } from "../db.ts";
import { c } from "../colors.ts";

export function abandon(): number {
  const active = getMostRecentActive();
  if (!active) {
    console.error(c.brightRed("Error:") + " no active session to abandon.");
    return 1;
  }
  abandonSession(active.id);
  console.log("");
  console.log(c.brightYellow("🏳️") + "  " + c.dim("Abandoned: ") + c.bold(active.task));
  console.log(c.dim("   (Excluded from stats. No shame; start a new one any time.)"));
  console.log("");
  return 0;
}
