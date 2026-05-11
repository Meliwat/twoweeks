import { createSession, getMostRecentActive } from "../db.ts";
import { parseEta, DEFAULT_ETA_TEXT, DEFAULT_ETA_MS } from "../eta.ts";
import { randomFlair } from "../flair.ts";
import { startCard } from "../format.ts";
import { c } from "../colors.ts";

export interface StartArgs {
  task: string;
  eta?: string;
  force?: boolean;
  json?: boolean;
}

export function start(args: StartArgs): number {
  if (!args.task || args.task.trim().length === 0) {
    if (args.json) {
      console.error(JSON.stringify({ ok: false, error: "task is required" }));
    } else {
      console.error(c.brightRed("Error:") + ' task is required. Try: twoweeks "build the auth flow"');
    }
    return 1;
  }

  const active = getMostRecentActive();
  if (active && !args.force) {
    if (args.json) {
      console.error(
        JSON.stringify({
          ok: false,
          error: "active_session_exists",
          active: active,
          hint: "ship or abandon first, or use --force",
        })
      );
    } else {
      console.log("");
      console.log(`${c.brightYellow("⚠️")}  You already have an active session: ${c.bold(active.task)}`);
      console.log(`   ${c.dim("Started " + new Date(active.started_at).toLocaleString() + ".")}`);
      console.log("");
      console.log(c.dim("Ship or abandon it first, or rerun with ") + c.bold("--force") + c.dim(" to start a new one in parallel."));
      console.log("");
    }
    return 2;
  }

  let eta: { text: string; ms: number };
  if (args.eta) {
    try {
      eta = parseEta(args.eta);
    } catch (err) {
      const msg = (err as Error).message;
      if (args.json) {
        console.error(JSON.stringify({ ok: false, error: msg }));
      } else {
        console.error(c.brightRed("Error:") + " " + msg);
      }
      return 1;
    }
  } else {
    eta = { text: DEFAULT_ETA_TEXT, ms: DEFAULT_ETA_MS };
  }

  const session = createSession(args.task.trim(), eta.text, eta.ms);

  if (args.json) {
    console.log(JSON.stringify({ ok: true, session }));
  } else {
    console.log(startCard(session, randomFlair()));
  }
  return 0;
}
