#!/usr/bin/env bun
import { start } from "./commands/start.ts";
import { status } from "./commands/status.ts";
import { ship } from "./commands/ship.ts";
import { share } from "./commands/share.ts";
import { abandon } from "./commands/abandon.ts";
import { history } from "./commands/history.ts";
import { c } from "./colors.ts";
import type { ShareTarget } from "./commands/share.ts";

const VERSION = "0.2.0";

const HELP = `
${c.brightGreen(c.bold("twoweeks"))} ${c.dim(`v${VERSION}`)}

${c.italic("Why your AI assistant always says two weeks but you ship by lunch.")}

${c.bold("Usage:")}
  ${c.bold("twoweeks \"task\"")}             Start a 2-week timer for "task"
  ${c.bold("twoweeks")}                    Show all active sessions + flair
  ${c.bold("twoweeks status")}             Same as bare command
  ${c.bold("twoweeks ship")}               Ship the most recent active session
  ${c.bold("twoweeks ship --share")}       Ship and open X with brag pre-filled
  ${c.bold("twoweeks share [id]")}         Open X intent (default: most recent shipped)
  ${c.bold("twoweeks history")}            Show shipped sessions + lifetime stats
  ${c.bold("twoweeks abandon")}            Abandon the most recent active session

${c.bold("Flags:")}
  ${c.bold("--eta \"3 months\"")}            Override the default 2-week ETA on start
  ${c.bold("--force")}                     Start a new session even if one is active
  ${c.bold("--to-bluesky")}                Share to Bluesky instead of X
  ${c.bold("--to-mastodon")}               Share to Mastodon instead of X
  ${c.bold("--print")}                     Print the share URL instead of opening
  ${c.bold("--no-color")}                  Disable ANSI colors (also set ${c.italic("NO_COLOR=1")})
  ${c.bold("--help, -h")}                  Show this help
  ${c.bold("--version, -v")}               Show version

${c.bold("Storage:")}
  ${c.dim("~/.twoweeks/history.db")}      ${c.dim("local SQLite, no telemetry, no cloud")}
  ${c.dim("$TWOWEEKS_HOME")}              ${c.dim("override storage directory")}
`;

interface ParsedArgs {
  help?: boolean;
  version?: boolean;
  share?: boolean;
  force?: boolean;
  print?: boolean;
  eta?: string;
  shareTarget?: ShareTarget;
}

function parseArgs(argv: string[]): { args: ParsedArgs; positional: string[] } {
  const args: ParsedArgs = {};
  const positional: string[] = [];

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--help" || a === "-h") args.help = true;
    else if (a === "--version" || a === "-v") args.version = true;
    else if (a === "--share") args.share = true;
    else if (a === "--force") args.force = true;
    else if (a === "--print") args.print = true;
    else if (a === "--to-bluesky") args.shareTarget = "bluesky";
    else if (a === "--to-mastodon") args.shareTarget = "mastodon";
    else if (a === "--to-x" || a === "--to-twitter") args.shareTarget = "x";
    else if (a === "--no-color") {
      // Handled by colors.ts via NO_COLOR env, but accept the flag too.
      process.env.NO_COLOR = "1";
    } else if (a === "--eta") {
      args.eta = argv[i + 1];
      i++;
    } else if (a.startsWith("--eta=")) {
      args.eta = a.slice("--eta=".length);
    } else {
      positional.push(a);
    }
  }
  return { args, positional };
}

function main(): number {
  const { args, positional } = parseArgs(Bun.argv.slice(2));

  if (args.help) {
    console.log(HELP);
    return 0;
  }
  if (args.version) {
    console.log(`twoweeks v${VERSION}`);
    return 0;
  }

  const command = positional[0];

  if (!command || command === "status") {
    return status();
  }

  if (command === "ship") {
    return ship({ share: !!args.share, shareTarget: args.shareTarget });
  }

  if (command === "share") {
    let id: number | undefined;
    if (positional[1] !== undefined) {
      id = parseInt(positional[1], 10);
      if (isNaN(id)) {
        console.error(c.brightRed("Error:") + ` invalid session id: ${positional[1]}`);
        return 1;
      }
    }
    return share({ id, target: args.shareTarget, print: args.print });
  }

  if (command === "abandon") {
    return abandon();
  }

  if (command === "history" || command === "board") {
    return history();
  }

  // Otherwise treat the first positional as the task
  return start({
    task: command,
    eta: args.eta,
    force: !!args.force,
  });
}

try {
  process.exit(main());
} catch (err) {
  console.error(c.brightRed("Unexpected error:") + " " + (err as Error).message);
  if (process.env.TWOWEEKS_DEBUG) {
    console.error((err as Error).stack);
  } else {
    console.error(c.dim("(set TWOWEEKS_DEBUG=1 for full stack trace)"));
  }
  process.exit(1);
}
