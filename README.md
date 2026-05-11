# twoweeks

[![test](https://img.shields.io/github/actions/workflow/status/Meliwat/twoweeks/test.yml?branch=main&style=flat-square&label=tests)](https://github.com/Meliwat/twoweeks/actions/workflows/test.yml)
[![License: MIT](https://img.shields.io/github/license/Meliwat/twoweeks?style=flat-square)](LICENSE)
[![Node](https://img.shields.io/badge/runtime-Node%2018%2B-339933?style=flat-square&logo=node.js)](https://nodejs.org)
[![Stars](https://img.shields.io/github/stars/Meliwat/twoweeks?style=flat-square)](https://github.com/Meliwat/twoweeks/stargazers)

> Why your AI assistant always says two weeks but you ship by lunch.

A tiny CLI that captures your AI's confident time estimate, times how long you actually took, and produces a brag card you can share. No accounts, no cloud, no telemetry — one local JSON file and one shareable PNG.

## Quick start (30 seconds)

```bash
git clone https://github.com/Meliwat/twoweeks
cd twoweeks
npm install
npm link

# Now `twoweeks` is on your PATH.
twoweeks "build the auth flow" "2 weeks"     # AI said this would take 2 weeks
# ... go build ...
twoweeks ship --screenshot                    # close the timer, save a PNG
```

That's it. A working CLI in under a minute.

## What it does

You ask an AI how long something will take. The AI confidently says "about 2 weeks of focused work." You ship it by lunch. `twoweeks` measures the gap and gives you a number you can share:

```
🎯 SHIPPED
──────────────────────────────────────────
Task:        build the auth flow
Estimated:   2 weeks
Actual:      47m 12s
Compression: 428x faster than the AI thought
Saved:       +13d 23h 12m
──────────────────────────────────────────

🎯 Triple-digit compression. Your AI is recalibrating.

📸 Screenshot: ~/.twoweeks/screenshots/compression-1.png
```

The PNG is 1200×630 (Open Graph dimensions) and ready to drop into a tweet.

![sample brag card](assets/social-preview.png)

## Why `"<eta>"` is required

The whole joke is timing the gap between what the AI said and what actually happened. So **you have to tell `twoweeks` what the AI said.** There is no default of "2 weeks" — that would be the tool staging the joke instead of capturing it.

```bash
twoweeks "build the auth flow"   "2 weeks"
twoweeks "ship the migration"    "3 months"
twoweeks "fix the bug"           "5 hours"
twoweeks "refactor the parser"   --eta "1 day"
```

The name `twoweeks` is the meme — what AIs always say. The tool measures whatever they actually said.

## Install

```bash
# From source (works today on any machine with Node 18+):
git clone https://github.com/Meliwat/twoweeks
cd twoweeks && npm install && npm link

# Homebrew (macOS / Linux):
brew install Meliwat/twoweeks/twoweeks

# npm (coming soon):
npm install -g twoweeks
```

`npm link` puts a symlink to the CLI on your `$PATH`. If it doesn't, you can also run it directly as `node /path/to/twoweeks/dist/cli.js`.

## Commands

| Command | What it does |
|---|---|
| `twoweeks "task" "<eta>"` | Start a timer with the AI's stated estimate |
| `twoweeks` | Show all active sessions and a status line |
| `twoweeks ship` | Close the most recent session, print the brag card |
| `twoweeks ship --share` | Ship and auto-open X with the brag pre-filled |
| `twoweeks ship --screenshot` | Ship and save a 1200×630 PNG of the brag card |
| `twoweeks screenshot [id]` | Render a PNG for a shipped session |
| `twoweeks share [id]` | Open X with the brag for a shipped session |
| `twoweeks history` | Shipped sessions + lifetime stats + achievements |
| `twoweeks abandon` | Abandon the current session (excluded from stats) |

## Flags

| Flag | What it does |
|---|---|
| `--eta "3 months"` | Provide AI estimate via flag instead of positional |
| `--force` | Start a new session even if one is already active |
| `--to-bluesky` / `--to-mastodon` | Share to Bluesky / Mastodon instead of X |
| `--print` | Print the share URL instead of opening the browser |
| `--screenshot` | (on `ship`) Also save a PNG of the brag card |
| `--copy` | (on `ship --screenshot`) Copy the PNG to clipboard (macOS) |
| `--out <path>` | Output path for the `screenshot` command |
| `--open` | (on `screenshot`) Open the PNG after saving |
| `--plain` | Plain-text output (no colors, no box drawing, no emoji) — screen-reader friendly |
| `--no-color` | Disable ANSI colors (also respects `NO_COLOR=1`) |
| `--no-emoji` | Strip emoji from output (also respects `TWOWEEKS_NO_EMOJI=1`) |
| `--json` | Emit machine-readable JSON |
| `--help, -h` | Show help |
| `--version, -v` | Show version |

## Accessibility

- **`--plain`** strips ANSI colors, box-drawing characters, and emoji from output. Designed for screen readers, SSH-without-unicode, and CI logs.
- **`--no-color`** (and `NO_COLOR=1`) disables colors only. Box-drawing and emoji remain.
- **`--no-emoji`** strips emoji while keeping colors. Useful for terminals without an emoji font.
- The result card uses `+`/`-` prefixes on the Saved / Cost line so over-budget vs under-budget reads correctly under any color vision.
- Every shipped PNG also writes a sidecar `compression-<id>.alt.txt` with the same content in plain text, so screen-reader users can paste it as alt text when sharing.
- `humanDurationSpoken` field in `--json` output gives "47 minutes 12 seconds" instead of "47m 12s" for screen-reader-friendly piping.

## Milestones

`twoweeks ship` prints a milestone line based on your compression ratio:

| Ratio | Milestone |
|---|---|
| ∞ (instant) | Submit this to Nature. |
| ≥ 1,000,000x | Million-x compression. Frame it. |
| ≥ 100,000x | Six-figure compression. The AI is recalibrating. |
| ≥ 10,000x | Five-figure compression. Solid Tuesday. |
| ≥ 1,000x | Four-figure compression. |
| ≥ 100x | Triple-digit compression. |
| ≥ 10x | Double-digit compression. |
| ≥ 1x | Within a hair of the estimate. |
| < 1x | The AI was, against all odds, correct. |

## Achievements

`twoweeks history` tracks 7 achievements:

- **First Ship** / **Hat Trick** / **Marathon** (1, 3, 10 ships)
- **100x Club** / **1000x Club** / **Million-x Club** (compression milestones)
- **Streak: 3 days** (consecutive shipping days)

## How it works

Every session gets stamped with the AI's stated ETA. When you ship, `twoweeks` computes:

```
ratio = eta_ms / actual_ms
```

A 2-week estimate shipped in 47 minutes is ~428x compression. The CLI then offers to open X (or Bluesky, or Mastodon) with a pre-filled brag, generate a shareable PNG, or both.

## Scripting

Every command supports `--json` for piping:

```bash
$ twoweeks ship --json | jq '.ratio_formatted'
"428x"

$ twoweeks history --json | jq '.stats.bestRatio'
1247.34

$ twoweeks --json | jq '.active[].task'
"build the auth flow"
```

## Storage

Local JSON at `~/.twoweeks/history.json`. PNG brag cards at `~/.twoweeks/screenshots/`. No cloud, no accounts, no telemetry. Override with `TWOWEEKS_HOME=/somewhere/else`.

## Troubleshooting

**`twoweeks: command not found`** — `npm link` couldn't add the binary to your PATH. Either fix that (run `npm link` again, check `$(npm prefix -g)/bin` is in PATH), or run the CLI directly: `node $(pwd)/dist/cli.js`.

**`Error: missing AI estimate`** — Pass the AI's estimate as the second argument: `twoweeks "task" "2 weeks"`. There's no default; the joke is capturing what the AI said.

**Box-drawing characters render as `?` or boxes** — Your terminal lacks Unicode support. Use `--plain` to get ASCII output.

**Emoji render as boxes** — Your terminal lacks an emoji font. Use `--no-emoji` or set `TWOWEEKS_NO_EMOJI=1`.

**`brew install` fails** — Make sure you ran `brew tap Meliwat/twoweeks` first, or use the full form: `brew install Meliwat/twoweeks/twoweeks`.

**Want to wipe your history?** — `rm -rf ~/.twoweeks` or delete just `~/.twoweeks/history.json`.

## Development

```bash
bun install            # install dev dependencies (Bun preferred for fast tests)
bun run cli "task" "2 weeks"
bun test               # run the test suite (43 tests)
bun run build          # build dist/cli.js (Node-compatible bundle)
```

## License

MIT. Have fun.
