# twoweeks

[![test](https://img.shields.io/github/actions/workflow/status/Meliwat/twoweeks/test.yml?branch=main&style=flat-square&label=tests)](https://github.com/Meliwat/twoweeks/actions/workflows/test.yml)
[![License: MIT](https://img.shields.io/github/license/Meliwat/twoweeks?style=flat-square)](LICENSE)
[![Node](https://img.shields.io/badge/runtime-Node%2018%2B-339933?style=flat-square&logo=node.js)](https://nodejs.org)
[![Bun](https://img.shields.io/badge/runtime-Bun-fbf0df?style=flat-square&logo=bun)](https://bun.sh)
[![Stars](https://img.shields.io/github/stars/Meliwat/twoweeks?style=flat-square)](https://github.com/Meliwat/twoweeks/stargazers)
[![PRs welcome](https://img.shields.io/badge/PRs-welcome-brightgreen?style=flat-square)](https://github.com/Meliwat/twoweeks/issues)

> Why your AI assistant always says two weeks but you ship by lunch.

A CLI that times the gap between your AI's confident estimate and your actual ship time. Built for the era where "this is a multi-month project" turns into a single Friday afternoon.

![the brag card](assets/social-preview.png)

```
$ twoweeks "build the auth flow"
⏰ 2 weeks remaining for: build the auth flow
   Worst case, the AI is right. Best case, you ship.

   (run `twoweeks ship` when you're done)

# ... go build ...

$ twoweeks ship --screenshot

🎯 SHIPPED
──────────────────────────────────────────
Task:        build the auth flow
Estimated:   2 weeks
Actual:      47m 12s
Compression: 428x faster than the AI thought
Saved:       13d 23h 12m
──────────────────────────────────────────

🎯  Triple-digit compression. Your AI is recalibrating.

📸 Screenshot: ~/.twoweeks/screenshots/compression-1.png

Want to brag? Run: twoweeks share 1
```

## Install

```bash
# Homebrew (macOS / Linux):
brew install Meliwat/twoweeks/twoweeks
twoweeks "task"

# When published to npm:
npm install -g twoweeks
twoweeks "task"

# or use without installing:
npx twoweeks "task"

# From source:
git clone https://github.com/Meliwat/twoweeks
cd twoweeks && bun install && bun link
```

Runs on **Node 18+** or **[Bun](https://bun.sh)** 1.0+. Storage is a single local JSON file at `~/.twoweeks/history.json`. No cloud, no telemetry, no accounts.

## Commands

| Command | What it does |
|---|---|
| `twoweeks "task"` | Start a 2-week timer for the task |
| `twoweeks` | Show all active sessions and a status update from the AI |
| `twoweeks status` | Same as bare command |
| `twoweeks ship` | Close the most recent active session, print the brag card |
| `twoweeks ship --share` | Ship and auto-open X with the brag pre-filled |
| `twoweeks ship --screenshot` | Ship and save a **1200×630 PNG of the brag card** (Open Graph dimensions, ready to share) |
| `twoweeks screenshot [id]` | Render a PNG for a shipped session (default: most recent) |
| `twoweeks share [id]` | Open X with the brag for a shipped session |
| `twoweeks history` | Shipped sessions + lifetime stats + **achievements** |
| `twoweeks abandon` | Abandon the current session (excluded from stats) |

## Flags

| Flag | What it does |
|---|---|
| `--eta "3 months"` | Override the default 2-week ETA when starting |
| `--force` | Start a new session even if one is already active |
| `--to-bluesky` | Share to Bluesky instead of X |
| `--to-mastodon` | Share to Mastodon instead of X |
| `--print` | Print the share URL instead of opening the browser |
| `--screenshot` | (on `ship`) Also save a PNG of the brag card |
| `--out <path>` | Output path for `screenshot` command |
| `--open` | (on `screenshot`) Open the PNG after saving |
| `--json` | Emit machine-readable JSON (every command). Pipe into `jq`. |
| `--no-color` | Disable ANSI colors (also respects `NO_COLOR=1`) |
| `--help, -h` | Show help |
| `--version, -v` | Show version |

## The brag card

`twoweeks ship --screenshot` (or `twoweeks screenshot <id>`) renders a 1200×630 PNG of your compression result, sized exactly for Open Graph link previews. Drop it into a tweet, a Slack message, a presentation — it's designed to read as a self-contained brag.

![sample brag card](assets/social-preview.png)

## Milestones

`twoweeks ship` prints a milestone line based on your compression ratio:

| Ratio | Milestone |
|---|---|
| ∞ (instant) | Time itself bent. Submit this to Nature. |
| ≥ 1,000,000x | Million-x compression. Send screenshot to your AI's emergency contact. |
| ≥ 100,000x | Six-figure compression. Your AI is in stage one of grief. |
| ≥ 10,000x | Five-figure compression. The leaderboard called; you're on it. |
| ≥ 1,000x | Four-figure compression. Frame this card. |
| ≥ 100x | Triple-digit compression. Your AI is recalibrating. |
| ≥ 10x | Double-digit compression. Solid Tuesday. |
| ≥ 2x | Faster than estimated. The AI quietly updates its priors. |
| ≥ 1x | Within a hair of the estimate. The AI feels seen. |
| ≥ 0.5x | Slower than estimated, but not by much. The AI was almost right. |
| < 0.5x | Significantly slower. The AI was, against all odds, correct. |

## Achievements

`twoweeks history` tracks 13 achievements with progress bars:

- **First Ship** / **Hat Trick** / **Marathon** / **Centurion** (1, 3, 10, 100 ships)
- **100x Club** / **1000x Club** / **Million-x Club** (compression milestones)
- **Time Bender** (any instant ship)
- **Estimation Slayer** (5 honest over-budget ships)
- **Streak: 3 days** / **Streak: 7 days** (consecutive shipping days)
- **Saved a Month** / **Saved a Year** (cumulative AI-time saved)

## How it works

Every session gets stamped with an ETA (default: 2 weeks). When you ship, `twoweeks` computes the compression ratio:

```
ratio = eta_ms / actual_ms
```

A 2-week estimate shipped in 47 minutes is ~428x compression. The CLI then offers to open X (or Bluesky, or Mastodon) with a pre-filled brag, or generate a sharable PNG.

## Scripting

Every command supports `--json` for piping:

```bash
$ twoweeks ship --json | jq '.ratio_formatted'
"428x"

$ twoweeks history --json | jq '.achievements[] | select(.earned)'
{ "id": "first_ship", "name": "First Ship", ... }

$ twoweeks --json | jq '.active[].task'
"build the auth flow"
```

## Storage

Local JSON at `~/.twoweeks/history.json`. PNG brag cards at `~/.twoweeks/screenshots/`. No cloud. No accounts. No telemetry. Override with `TWOWEEKS_HOME=/somewhere/else`.

## Development

```bash
bun install            # install dev dependencies
bun run cli "task"     # run from source
bun test               # run the test suite (39 tests)
bun run build          # build dist/cli.js
```

## License

MIT. Have fun.
