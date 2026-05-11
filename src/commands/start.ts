import { createSession, getMostRecentActive } from "../db.ts";
import { parseEta, DEFAULT_ETA_TEXT, DEFAULT_ETA_MS } from "../eta.ts";
import { randomFlair } from "../flair.ts";

export interface StartArgs {
  task: string;
  eta?: string;
  force?: boolean;
}

export function start(args: StartArgs): number {
  if (!args.task) {
    console.error('Error: task is required. Try: twoweeks "build the auth flow"');
    return 1;
  }

  const active = getMostRecentActive();
  if (active && !args.force) {
    console.log("");
    console.log(`⚠️  You already have an active session: "${active.task}"`);
    console.log(`   Started ${new Date(active.started_at).toLocaleString()}.`);
    console.log("");
    console.log("Ship or abandon it first, or rerun with --force to start a new one in parallel.");
    console.log("");
    return 2;
  }

  let eta: { text: string; ms: number };
  if (args.eta) {
    try {
      eta = parseEta(args.eta);
    } catch (err) {
      console.error((err as Error).message);
      return 1;
    }
  } else {
    eta = { text: DEFAULT_ETA_TEXT, ms: DEFAULT_ETA_MS };
  }

  const session = createSession(args.task, eta.text, eta.ms);

  console.log("");
  console.log(`⏰ ${eta.text} remaining for: ${session.task}`);
  console.log(`   ${randomFlair()}`);
  console.log("");
  console.log(`   (run \`twoweeks ship\` when you're done)`);
  console.log("");
  return 0;
}
