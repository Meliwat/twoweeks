# twoweeks

[![License: MIT](https://img.shields.io/github/license/Meliwat/twoweeks?style=flat-square)](LICENSE)
[![Bun](https://img.shields.io/badge/runtime-Bun-fbf0df?style=flat-square&logo=bun)](https://bun.sh)
[![Stars](https://img.shields.io/github/stars/Meliwat/twoweeks?style=flat-square)](https://github.com/Meliwat/twoweeks/stargazers)
[![PRs welcome](https://img.shields.io/badge/PRs-welcome-brightgreen?style=flat-square)](https://github.com/Meliwat/twoweeks/issues)

> Why your AI assistant always says two weeks but you ship by lunch.

A CLI that times the gap between your AI's confident estimate and your actual ship time. Built for the era where "this is a multi-month project" turns into a single Friday afternoon.

![demo](assets/demo.gif)

```
$ twoweeks "build the auth flow"
⏰ 2 weeks remaining for: build the auth flow
   Worst case, the AI is right. Best case, you ship.

   (run `twoweeks ship` when you're done)

# ... go build ...

$ twoweeks ship

🎯 SHIPPED
──────────────────────────────────────────
Task:        build the auth flow
Estimated:   2 weeks
Actual:      47m 12s
Compression: 425x faster than the AI thought
Saved:       13d 23h 12m
──────────────────────────────────────────

🎯  Triple-digit compression. Your AI is recalibrating.

Want to brag? Run: twoweeks share 1
```

## Requirements

Requires [Bun](https://bun.sh) `>= 1.0`. `twoweeks` uses `bun:sqlite` (Bun's built-in SQLite). Node won't run it directly because [Bun doesn't yet support `better-sqlite3`](https://github.com/oven-sh/bun/issues/4290), so Bun is the runtime.

Install Bun if you haven't:

```bash
curl -fsSL https://bun.sh/install | bash
```

## Install

**Via npm (when published):**

```bash
npm install -g twoweeks
# or
bunx twoweeks "task"
```

**From source:**

```bash
git clone https://github.com/Meliwat/twoweeks
cd twoweeks
bun install
bun link
# now `twoweeks` is on your PATH globally
```

## Commands

| Command | What it does |
|---|---|
| `twoweeks "task"` | Start a 2-week timer for the task |
| `twoweeks` | Show all active sessions and a status update from the AI |
| `twoweeks status` | Same as bare command |
| `twoweeks ship` | Close the most recent active session, print the brag card |
| `twoweeks ship --share` | Ship and auto-open X with the brag pre-filled |
| `twoweeks share [id]` | Open X with the brag for a shipped session (default: most recent) |
| `twoweeks history` | Show all shipped sessions + lifetime stats |
| `twoweeks abandon` | Abandon the current session (excluded from stats) |

## Flags

| Flag | What it does |
|---|---|
| `--eta "3 months"` | Override the default 2-week ETA when starting |
| `--force` | Start a new session even if one is already active |
| `--to-bluesky` | Share to Bluesky instead of X |
| `--to-mastodon` | Share to Mastodon instead of X |
| `--print` | Print the share URL instead of opening the browser |
| `--no-color` | Disable ANSI colors (also respects `NO_COLOR=1`) |
| `--help, -h` | Show help |
| `--version, -v` | Show version |

## Milestones

`twoweeks ship` prints a milestone line based on your compression ratio:

| Ratio | Milestone |
|---|---|
| ≥ 1,000,000x | Million-x compression. Send screenshot to your AI's emergency contact. |
| ≥ 100,000x | Six-figure compression. Your AI is in stage one of grief. |
| ≥ 10,000x | Five-figure compression. The leaderboard called; you're on it. |
| ≥ 1,000x | Four-figure compression. Frame this card. |
| ≥ 100x | Triple-digit compression. Your AI is recalibrating. |
| ≥ 10x | Double-digit compression. Solid Tuesday. |
| ≥ 2x | Faster than estimated. The AI quietly updates its priors. |
| ≥ 1x | Exactly on time. The AI feels seen. |
| < 1x | Slower than estimated. The AI was, against all odds, right. |

## How it works

Every session gets stamped with an ETA (default: 2 weeks). When you ship, `twoweeks` computes the compression ratio:

```
ratio = round(eta_ms / actual_ms)
```

A 2-week estimate shipped in 47 minutes is a 425x compression. The CLI then offers to open X (or Bluesky, or Mastodon) with a pre-filled brag for the world to enjoy.

## Storage

Local SQLite at `~/.twoweeks/history.db`. No cloud. No accounts. No telemetry. Override with `TWOWEEKS_HOME=/somewhere/else`.

Your AI's overconfidence stays between you and your terminal.

## Development

```bash
bun install            # install dependencies
bun run cli "task"     # run from source
bun test               # run the test suite
bun run build          # build dist/cli.js
```

## License

MIT. Have fun.
