import { getActiveSessions } from "../db.ts";
import { statusCard } from "../format.ts";
import { randomFlair } from "../flair.ts";
import { c } from "../colors.ts";

export interface StatusArgs {
  json?: boolean;
  plain?: boolean;
  noEmoji?: boolean;
}

export function status(args: StatusArgs = {}): number {
  const sessions = getActiveSessions();

  if (args.json) {
    console.log(JSON.stringify({ ok: true, active: sessions }));
    return 0;
  }

  if (sessions.length === 0) {
    if (args.plain) {
      console.log('No active sessions. Start one: twoweeks "build the auth flow" "2 weeks"');
    } else {
      console.log("");
      console.log(c.dim("No active sessions."));
      console.log("");
      console.log(c.dim("Start one: ") + c.bold('twoweeks "build the auth flow" "2 weeks"'));
      console.log("");
    }
    return 0;
  }
  for (const s of sessions) {
    console.log(statusCard(s, randomFlair(), { plain: args.plain, noEmoji: args.noEmoji }));
  }
  return 0;
}
