#!/usr/bin/env bun
import { start } from "./commands/start.ts";
import { status } from "./commands/status.ts";
import { ship } from "./commands/ship.ts";
import { share } from "./commands/share.ts";
import { abandon } from "./commands/abandon.ts";

const VERSION = "0.1.0";

const HELP = `
twoweeks v${VERSION}

Why your AI assistant always says two weeks but you ship by lunch.

Usage:
  twoweeks "task"             Start a 2-week timer for "task"
  twoweeks                    Show all active sessions + flair
  twoweeks status             Same as above
  twoweeks ship               Ship the most recent active session
  twoweeks ship --share       Ship and open X with brag pre-filled
  twoweeks share [id]         Open X intent for shipped session (default: most recent)
  twoweeks abandon            Abandon the most recent active session

Flags:
  --eta "3 months"            Override the default 2-week ETA on start
  --force                     Start a new session even if one is active
  --help, -h                  Show this help
  --version, -v               Show version

Storage:
  ~/.twoweeks/history.db (local SQLite, no telemetry, no cloud)
`;

interface ParsedArgs {
  help?: boolean;
  version?: boolean;
  share?: boolean;
  force?: boolean;
  eta?: string;
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
    else if (a === "--eta") {
      args.eta = argv[i + 1];
      i++;
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
    return ship({ share: !!args.share });
  }

  if (command === "share") {
    let id: number | undefined;
    if (positional[1] !== undefined) {
      id = parseInt(positional[1], 10);
      if (isNaN(id)) {
        console.error(`Invalid session id: ${positional[1]}`);
        return 1;
      }
    }
    return share({ id });
  }

  if (command === "abandon") {
    return abandon();
  }

  // Otherwise treat the first positional as the task
  return start({
    task: command,
    eta: args.eta,
    force: !!args.force,
  });
}

process.exit(main());
