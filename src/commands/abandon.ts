import { getMostRecentActive, abandonSession } from "../db.ts";

export function abandon(): number {
  const active = getMostRecentActive();
  if (!active) {
    console.error("No active session to abandon.");
    return 1;
  }
  abandonSession(active.id);
  console.log("");
  console.log(`Abandoned: "${active.task}"`);
  console.log("(Excluded from stats. No shame; you can start a new one any time.)");
  console.log("");
  return 0;
}
