import { createSession, getMostRecentActive } from "../db.ts";
import { parseEta } from "../eta.ts";
import { randomFlair } from "../flair.ts";
import { startCard } from "../format.ts";
import { c } from "../colors.ts";

export interface StartArgs {
  task: string;
  eta?: string;
  quote?: string;
  force?: boolean;
  plain?: boolean;
  noEmoji?: boolean;
  json?: boolean;
}

const MISSING_ETA_HELP = `Pass the AI's estimate as the second argument or via --eta:

  twoweeks "build the auth flow" "2 weeks"
  twoweeks "build the auth flow" "3 months"
  twoweeks "build the auth flow" --eta "5 hours"

Accepts: minute(s), hour(s), day(s), week(s), month(s).

Tip: run \`twoweeks install-hook\` to auto-capture estimates from Claude Code.`;

export function start(args: StartArgs): number {
  if (!args.task || args.task.trim().length === 0) {
    if (args.json) {
      console.error(JSON.stringify({ ok: false, error: "task is required" }));
    } else if (args.plain) {
      console.error('Error: task is required. Try: twoweeks "build the auth flow" "2 weeks"');
    } else {
      console.error(c.brightRed("Error:") + ' task is required. Try: twoweeks "build the auth flow" "2 weeks"');
    }
    return 1;
  }

  if (!args.eta) {
    if (args.json) {
      console.error(JSON.stringify({ ok: false, error: "eta_required", hint: "twoweeks needs the AI's estimate; pass it as the second arg or via --eta" }));
    } else if (args.plain) {
      console.error("Error: missing AI estimate.\n");
      console.error(MISSING_ETA_HELP);
    } else {
      console.error("");
      console.error(c.brightRed("Error: missing AI estimate."));
      console.error("");
      console.error(MISSING_ETA_HELP);
      console.error("");
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
    } else if (args.plain) {
      console.error(`Warning: active session "${active.task}" started ${new Date(active.started_at).toLocaleString()}.`);
      console.error("Ship or abandon it first, or rerun with --force to start a new one.");
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
  try {
    eta = parseEta(args.eta);
  } catch (err) {
    const msg = (err as Error).message;
    if (args.json) {
      console.error(JSON.stringify({ ok: false, error: msg }));
    } else if (args.plain) {
      console.error("Error: " + msg);
    } else {
      console.error(c.brightRed("Error:") + " " + msg);
    }
    return 1;
  }

  const session = createSession(args.task.trim(), eta.text, eta.ms, args.quote);

  if (args.json) {
    console.log(JSON.stringify({ ok: true, session }));
  } else {
    console.log(startCard(session, randomFlair(), { plain: args.plain, noEmoji: args.noEmoji }));
  }
  return 0;
}
