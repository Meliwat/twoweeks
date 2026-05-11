import { getActiveSessions } from "../db.ts";
import { statusCard } from "../format.ts";
import { randomFlair } from "../flair.ts";

export function status(): number {
  const sessions = getActiveSessions();
  if (sessions.length === 0) {
    console.log("");
    console.log("No active sessions.");
    console.log("");
    console.log('Start one: twoweeks "build the auth flow"');
    console.log("");
    return 0;
  }
  for (const s of sessions) {
    console.log(statusCard(s, randomFlair()));
  }
  return 0;
}
