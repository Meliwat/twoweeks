# Autopilot run — twoweeks v1

Started: 2026-05-11
Goal: Build twoweeks v1 CLI per spec at `~/.gstack/projects/crazyidea/meliwat-unknown-design-20260511-122559.md`. Project ready to test via `bun run cli "task"` and `bun run cli ship`.

## Decisions

- **Installed Bun (1.3.13) via `curl bun.sh/install`** — Bun not present on system, spec mandates Bun runtime. User-level install, no permission needed.
- **Used `bun:sqlite` not `better-sqlite3`** — matches the spec's Data Model section literally. Note: this means npm-published bundles will only run under Bun (npx falls back to Node which lacks `bun:sqlite`). Flagging here so v1.1 spec can resolve the bun:sqlite vs npm-distribution conflict. For the user's specified test path (`bun run cli`), this is correct.
- **No external CLI arg parser (commander/yargs)** — bare argv parsing. 5 commands, low complexity, saves a dep.
- **Module layout: src/cli.ts dispatcher + src/commands/\*.ts + src/db.ts + src/format.ts + src/flair.ts + src/eta.ts** — one-file-per-concern, matches spec's intended structure.
- **`status` command alias of bare invocation** — bare `bun run cli` shows active session + flair, `bun run cli status` does same.
- **ETA parser supports: minute(s), hour(s), day(s), week(s), month(s)** — month = 30 days for simplicity.
- **Random flair pick per status call** — uses `Math.random()`, 18 messages.
- **`ship --share` automatically opens X intent URL via `open` (macOS) / `xdg-open` (linux)** — falls back to printing URL if shell exec fails.
- **No tests in v1** — spec does not require them, weekend ship priority. Manual lifecycle test only.

## Follow-up pass (post-autopilot, same session)

- **Pre-flight name check:** `gh search repos twoweeks --limit 20` → ~20 existing repos by that name, all small/personal; `npm view twoweeks` → 404 (available); `brew search twoweeks` → no formula. **Verdict: proceed with the name.** `meliwat/twoweeks` is clear.
- **Attempted `bun:sqlite` → `better-sqlite3` swap:** failed. Bun doesn't yet support `better-sqlite3` (oven-sh/bun#4290). Reverted to `bun:sqlite`. New decision: **Bun is a hard runtime requirement.** Shebang in `dist/cli.js` is `#!/usr/bin/env bun`. `npx twoweeks` works iff Bun is installed; otherwise users hit "bun: command not found." README updated to make this explicit.
- **Added `dist/cli.js` build step:** `bun build src/cli.ts --target=bun --outfile=dist/cli.js && chmod +x dist/cli.js`. Output is a 12KB single-file bundle with `#!/usr/bin/env bun` shebang baked in by Bun. `package.json#bin` now points at `./dist/cli.js`. `prepublishOnly` runs the build automatically. `files` field updated to ship `dist/` (not `src/`).
- **Demo gif via asciinema + agg:** recorded `assets/demo.cast` from `assets/demo.sh` (~22-second scripted lifecycle). Converted to `assets/demo.gif` (60KB, monokai theme). README embeds it at the top. **Quality caveat:** the recording is mechanical (sleep-paced, not human-paced) and exposes the `bun run src/cli.ts` invocation rather than a polished `twoweeks` command. **Pre-launch the user should re-record on their own machine** with deliberate pacing, their preferred theme, and after `npm install -g` so the prompt shows `twoweeks` instead of the dev path.

## Round 2 — push from 3.5 to 5 stars

User asked for 5-star product. Iterating until a fresh subagent rates it 5/5. Round 1 changes:

- **ANSI colors throughout output.** New `src/colors.ts` helper auto-detects TTY and respects `NO_COLOR=1` and `--no-color`. Result card has bright-green SHIPPED, bright-yellow actual time, bright-green bold compression ratio, dim labels. Status card has bright-cyan countdown, dim italic flair. Status output now actually pops on dark terminals.
- **Restored `history` command** (was cut from v1 in spec). Shows top-10 shipped sessions in a table with id, ratio, actual duration, task. Plus lifetime stats: total shipped, best compression, avg compression, lifetime saved, abandoned count. `twoweeks board` aliased for muscle memory.
- **Milestone messages.** `src/flair.ts` now exports `milestoneFor(ratio)` returning a punch line keyed to compression ratio bands (10x, 100x, 1Kx, 10Kx, 100Kx, 1Mx, Infinity). Result card prints the milestone after the brag block. Triple-digit, four-figure, etc. — each gets a unique line. The Infinity case ("time itself bent. Submit this to Nature.") handles instant-ship.
- **Expanded flair messages** from 18 to 25, with sharper punchlines (e.g., "The AI did not factor in the existence of itself.", "Vibes-wise, the AI is unbothered.").
- **Bluesky + Mastodon share targets.** `--to-bluesky` opens `bsky.app/intent/compose`, `--to-mastodon` opens `toot.kytta.dev` (instance-agnostic Mastodon share). Default still X. `--print` flag prints URL instead of opening browser.
- **Edge cases:**
  - Long task names (>60 chars) truncated with `…` in all output.
  - Sub-second durations now render as `Nms` instead of `0s`.
  - Large ratios compress to `1.2Kx` / `31.0Mx` / `∞x` formats (was raw `31015385`).
  - Negative durations clamp to `0ms`.
  - Empty task strings rejected with clear error.
- **Tests via `bun test`.** 37 tests, 0 fail. Coverage: `parseEta` (10 cases incl. edge), `humanDuration` / `formatRatio` / `computeRatio` (13 cases incl. boundaries + infinity), full `db.ts` lifecycle (createSession → ship → abandon → stats round-trip). `db.test.ts` isolates via `TWOWEEKS_HOME=/tmp/twoweeks-test-{pid}`.
- **`TWOWEEKS_HOME` env override** for the storage directory. Enables CI-friendly testing without trashing the user's real history.
- **Global error handler in `cli.ts`** catches unexpected throws, prints a clean message, suggests `TWOWEEKS_DEBUG=1` for the full stack.
- **`--no-color` flag** in addition to `NO_COLOR=1` env, for users who want explicit control.
- **package.json polish:** version bumped to 0.2.0, added `homepage`, `repository`, `bugs` fields. `prepublishOnly` now runs `bun run build && bun test` (no broken publishes).
- **README rewrite:** added shield badges (license, Bun, stars, PRs welcome), milestone table, share-target docs, `TWOWEEKS_HOME` docs, development section with `bun test` mention.

Spawning reviewer next.

