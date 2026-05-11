#!/usr/bin/env node
import { start } from "./commands/start.ts";
import { status } from "./commands/status.ts";
import { ship } from "./commands/ship.ts";
import { share } from "./commands/share.ts";
import { abandon } from "./commands/abandon.ts";
import { history } from "./commands/history.ts";
import { screenshotCmd } from "./commands/screenshot.ts";
import { watch } from "./commands/watch.ts";
import { installHook } from "./commands/install-hook.ts";
import { c } from "./colors.ts";
import type { ShareTarget } from "./commands/share.ts";

const VERSION = "0.7.0";

const HELP = `
${c.brightGreen(c.bold("twoweeks"))} ${c.dim(`v${VERSION}`)}

${c.italic("Capture your AI's confident estimate. Time the gap. Brag.")}

${c.bold("Usage:")}
  ${c.bold("twoweeks \"task\" \"<eta>\"")}         Start a timer with the AI's stated estimate  ${c.dim("(required)")}
  ${c.bold("twoweeks")}                        Show all active sessions + flair
  ${c.bold("twoweeks status")}                 Same as bare command
  ${c.bold("twoweeks ship")}                   Ship the most recent active session
  ${c.bold("twoweeks ship --share")}           Ship and open X with brag pre-filled
  ${c.bold("twoweeks ship --screenshot")}      Ship and save a 1200x630 PNG brag card
  ${c.bold("twoweeks screenshot [id]")}        Render a PNG for a shipped session
  ${c.bold("twoweeks share [id]")}             Open X intent (default: most recent shipped)
  ${c.bold("twoweeks history")}                Show shipped sessions + lifetime stats + achievements
  ${c.bold("twoweeks abandon")}                Abandon the most recent active session
  ${c.bold("twoweeks install-hook")}           Auto-capture Claude's estimates in Claude Code  ${c.dim("(zero invocation)")}
  ${c.bold("twoweeks uninstall-hook")}         Remove the Claude Code auto-capture hook
  ${c.bold("twoweeks watch")}                  Read text from stdin, capture an estimate if found

${c.bold("Examples:")}
  ${c.dim("# AI said it'd take 2 weeks. You actually shipped in 47 minutes.")}
  ${c.bold("$ twoweeks \"build the auth flow\" \"2 weeks\"")}
  ${c.bold("$ twoweeks ship --screenshot --copy")}
  ${c.dim("# Compression: 428x faster than the AI thought (and the PNG is on your clipboard)")}

  ${c.dim("# Or zero-touch: install the Claude Code hook and forget about it.")}
  ${c.bold("$ twoweeks install-hook")}
  ${c.dim("# Next time Claude says \"about 2 weeks of focused work,\" twoweeks catches it.")}

${c.bold("Flags:")}
  ${c.bold("--eta \"<duration>\"")}              AI estimate via flag instead of second positional
  ${c.bold("--quote \"<text>\"")}                Verbatim AI quote (rendered on the brag card)
  ${c.bold("--force")}                         Start a new session even if one is already active
  ${c.bold("--to-bluesky")}                    Share to Bluesky instead of X
  ${c.bold("--to-mastodon")}                   Share to Mastodon instead of X
  ${c.bold("--print")}                         Print the share URL instead of opening
  ${c.bold("--screenshot")}                    (on ship) Save a PNG of the brag card
  ${c.bold("--copy")}                          (on ship/screenshot, macOS) Copy the PNG to clipboard
  ${c.bold("--out <path>")}                    Output path for screenshot command
  ${c.bold("--open")}                          (on screenshot) Open the PNG after saving
  ${c.bold("--plain")}                         Plain text (no colors / box drawing / emoji)
  ${c.bold("--no-color")}                      Disable ANSI colors (also set ${c.italic("NO_COLOR=1")})
  ${c.bold("--no-emoji")}                      Strip emoji (also set ${c.italic("TWOWEEKS_NO_EMOJI=1")})
  ${c.bold("--json")}                          Machine-readable JSON output
  ${c.bold("--help, -h")}                      Show this help
  ${c.bold("--version, -v")}                   Show version

${c.bold("Storage:")}
  ${c.dim("~/.twoweeks/history.json")}        ${c.dim("local JSON, no telemetry, no cloud")}
  ${c.dim("~/.twoweeks/screenshots/")}        ${c.dim("PNG brag cards (with .alt.txt sidecars)")}
  ${c.dim("$TWOWEEKS_HOME")}                  ${c.dim("override storage directory")}
  ${c.dim("$TWOWEEKS_NO_EMOJI")}              ${c.dim("=1 strips emoji from output")}
  ${c.dim("$TWOWEEKS_DEBUG")}                 ${c.dim("=1 prints stack on unexpected errors")}
`;

interface ParsedArgs {
  help?: boolean;
  version?: boolean;
  share?: boolean;
  force?: boolean;
  print?: boolean;
  json?: boolean;
  screenshot?: boolean;
  open?: boolean;
  copy?: boolean;
  plain?: boolean;
  noEmoji?: boolean;
  quiet?: boolean;
  fromHook?: boolean;
  out?: string;
  eta?: string;
  quote?: string;
  challenge?: string;
  from?: string;
  task?: string;
  scope?: "user" | "project";
  shareTarget?: ShareTarget;
}

export function parseArgs(argv: string[]): { args: ParsedArgs; positional: string[] } {
  const args: ParsedArgs = {};
  const positional: string[] = [];

  // Pick up env defaults first (flag wins if both present)
  if (process.env.TWOWEEKS_NO_EMOJI && process.env.TWOWEEKS_NO_EMOJI !== "0" && process.env.TWOWEEKS_NO_EMOJI.toLowerCase() !== "false") {
    args.noEmoji = true;
  }

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--help" || a === "-h") args.help = true;
    else if (a === "--version" || a === "-v") args.version = true;
    else if (a === "--share") args.share = true;
    else if (a === "--force") args.force = true;
    else if (a === "--print") args.print = true;
    else if (a === "--json") args.json = true;
    else if (a === "--screenshot") args.screenshot = true;
    else if (a === "--open") args.open = true;
    else if (a === "--copy") args.copy = true;
    else if (a === "--quiet") args.quiet = true;
    else if (a === "--from-hook") args.fromHook = true;
    else if (a === "--project") args.scope = "project";
    else if (a === "--user") args.scope = "user";
    else if (a === "--plain") {
      args.plain = true;
      process.env.NO_COLOR = "1";
      args.noEmoji = true;
    } else if (a === "--no-emoji") args.noEmoji = true;
    else if (a === "--to-bluesky") args.shareTarget = "bluesky";
    else if (a === "--to-mastodon") args.shareTarget = "mastodon";
    else if (a === "--to-x" || a === "--to-twitter") args.shareTarget = "x";
    else if (a === "--no-color") {
      process.env.NO_COLOR = "1";
    } else if (a === "--eta") {
      args.eta = argv[i + 1];
      i++;
    } else if (a.startsWith("--eta=")) {
      args.eta = a.slice("--eta=".length);
    } else if (a === "--quote") {
      args.quote = argv[i + 1];
      i++;
    } else if (a.startsWith("--quote=")) {
      args.quote = a.slice("--quote=".length);
    } else if (a === "--challenge") {
      args.challenge = argv[i + 1];
      i++;
    } else if (a.startsWith("--challenge=")) {
      args.challenge = a.slice("--challenge=".length);
    } else if (a === "--out") {
      args.out = argv[i + 1];
      i++;
    } else if (a.startsWith("--out=")) {
      args.out = a.slice("--out=".length);
    } else if (a === "--from") {
      args.from = argv[i + 1];
      i++;
    } else if (a.startsWith("--from=")) {
      args.from = a.slice("--from=".length);
    } else if (a === "--task") {
      args.task = argv[i + 1];
      i++;
    } else if (a.startsWith("--task=")) {
      args.task = a.slice("--task=".length);
    } else {
      positional.push(a);
    }
  }
  return { args, positional };
}

const KNOWN_COMMANDS = new Set([
  "status",
  "ship",
  "screenshot",
  "share",
  "abandon",
  "history",
  "board",
  "watch",
  "install-hook",
  "uninstall-hook",
]);

function isTruthy(value: string | undefined): boolean {
  if (value === undefined || value === "") return false;
  const v = value.toLowerCase();
  return v !== "0" && v !== "false" && v !== "no" && v !== "off";
}

async function main(): Promise<number> {
  const { args, positional } = parseArgs(process.argv.slice(2));

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
    return status({ json: !!args.json, plain: !!args.plain, noEmoji: !!args.noEmoji });
  }

  if (command === "ship") {
    return await ship({
      share: !!args.share,
      shareTarget: args.shareTarget,
      screenshot: !!args.screenshot,
      screenshotOut: args.out,
      copy: !!args.copy,
      plain: !!args.plain,
      noEmoji: !!args.noEmoji,
      json: !!args.json,
    });
  }

  if (command === "screenshot") {
    let id: number | undefined;
    if (positional[1] !== undefined) {
      id = parseInt(positional[1], 10);
      if (isNaN(id)) {
        console.error(c.brightRed("Error:") + ` invalid session id: ${positional[1]}`);
        return 1;
      }
    }
    return await screenshotCmd({
      id,
      out: args.out,
      open: !!args.open,
      copy: !!args.copy,
      plain: !!args.plain,
      json: !!args.json,
    });
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
    return share({
      id,
      target: args.shareTarget,
      print: args.print,
      challenge: args.challenge,
      json: !!args.json,
    });
  }

  if (command === "abandon") {
    return abandon({ json: !!args.json, plain: !!args.plain });
  }

  if (command === "history" || command === "board") {
    return history({ json: !!args.json, plain: !!args.plain, noEmoji: !!args.noEmoji });
  }

  if (command === "watch") {
    return await watch({
      fromPath: args.from,
      fromHook: !!args.fromHook,
      task: args.task,
      quiet: !!args.quiet,
      json: !!args.json,
      plain: !!args.plain,
    });
  }

  if (command === "install-hook") {
    return installHook({ scope: args.scope, json: !!args.json });
  }

  if (command === "uninstall-hook") {
    return installHook({ uninstall: true, scope: args.scope, json: !!args.json });
  }

  // First positional is the task. Second positional (if not a known subcommand)
  // is the ETA. --eta flag takes precedence if both are provided.
  const task = command;
  let etaInput = args.eta;
  if (!etaInput && positional[1] && !KNOWN_COMMANDS.has(positional[1])) {
    etaInput = positional[1];
  }

  return start({
    task,
    eta: etaInput,
    quote: args.quote,
    force: !!args.force,
    plain: !!args.plain,
    noEmoji: !!args.noEmoji,
    json: !!args.json,
  });
}

main()
  .then((code) => process.exit(code))
  .catch((err) => {
    const e = err as Error;
    if (process.argv.includes("--json")) {
      console.error(JSON.stringify({ ok: false, error: e.message }));
    } else {
      console.error(c.brightRed("Unexpected error:") + " " + e.message);
      if (isTruthy(process.env.TWOWEEKS_DEBUG)) {
        console.error(e.stack);
      } else {
        console.error(c.dim("(set TWOWEEKS_DEBUG=1 for full stack trace)"));
      }
    }
    process.exit(1);
  });
