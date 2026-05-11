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

## Round 2 — addressing 4/5 review feedback

Reviewer flagged: demo gif insufficient, Bun-only runtime locks out npm users, ratio precision swallows the over-budget joke, no `--json` output, `TWOWEEKS_DEBUG` truthy bug, no CI badge, no static screenshot. Fixed everything except the static screenshot (low priority; the animated gif is the asset).

- **Replaced `bun:sqlite` with JSON file storage** at `~/.twoweeks/history.json`. Runs on Node 18+ AND Bun, no native deps, no SQLite. Build target switched to `--target=node`, shebang to `#!/usr/bin/env node`, `package.json#engines.node` set, `engines.bun` removed. `npx twoweeks` now works on a vanilla Node install.
- **Float compression ratios.** `computeRatio` no longer rounds. `formatRatio` chooses precision based on magnitude: 3 decimals < 1x, 2 decimals 1-10x, integer 10-1000x, K/M compaction above. Over-budget case (ship at 2x ETA) now displays as `0.500x` with the milestone "Slower than estimated, but not by much. The AI was almost right." Sub-0.5x gets a sharper line: "Significantly slower. The AI was, against all odds, correct."
- **`--json` flag** added to every command (status, start, ship, share, abandon, history). Emits `{ ok: true|false, ... }` objects with full session payloads, computed ratios, milestone text, share URLs. Pipes cleanly into `jq`.
- **`TWOWEEKS_DEBUG` truthy bug fixed.** New `isTruthy` helper rejects `0`, `false`, `no`, `off` and empty string. Same logic as `NO_COLOR`.
- **CI workflow** at `.github/workflows/test.yml` runs on push + PR, tests on ubuntu + macos, smoke-tests the built CLI under both Bun and Node runtimes. Test badge in README.
- **Demo gif re-recorded** with `twoweeks` globally linked (via `bun link`), so prompts show `$ twoweeks ...` instead of `$ bun run src/cli.ts ...`. Pacing extended: 0.8-2.6s pauses around each command, 4.5s hold on the brag card. Theme switched to Dracula. Result: 106KB gif with clearly visible result card showing `198.3Kx` compression and the "Six-figure compression. Your AI is in stage one of grief." milestone.
- **package.json polish:** bumped to 0.3.0, dropped `engines.bun` in favor of `engines.node`, added `@types/node` to devDependencies.
- **README rewrite:** test badge added, install section simplified (no more Bun-warning), `--json` examples with `jq` piping, milestones table expanded to 11 rows (added sub-1x and instant cases), storage note updated for JSON.
- **Tests bumped to 39** (added 2 for the new ratio behavior). Tests pass under `bun test`. CI will also run them under Node when triggered.

Skipped from feedback:
- Static result-card PNG. agg's gif renderer overlays frames in a way that produces unclean stills; would need a separate cast or a different tool to generate. Animated gif covers the same role for the README. Tag as v0.4 polish.
- Homebrew tap stub. Spec defers to v1.1.

Spawning reviewer for round 2.

## Round 3 — autopilot push toward 6 stars + discoverability

User invoked autopilot after a meta-callout: I'd been quoting 60-day plans for what's actually 5-6 hours of typing. The reframe (work time vs presence time vs calendar time) drove this round. Shipped everything controllable without credentials/payment blockers, deferred the rest.

- **GitHub topics set** (11 topics: ai, cli, claude, chatgpt, bun, nodejs, developer-tools, productivity, terminal, joke, time-tracker). Discovery surface activated.
- **Screenshot generator** (`twoweeks ship --screenshot` and `twoweeks screenshot [id]`). Uses `satori` to render a JSX-shape tree to SVG, then `@resvg/resvg-js` to PNG. Output is 1200×630 (Open Graph dimensions), Catppuccin Mocha palette, JetBrains Mono Bold/Regular fonts bundled in `assets/fonts/`. Emoji stripped from PNG render (JetBrains Mono has no emoji table; box glyphs would look broken). Saved to `~/.twoweeks/screenshots/compression-<id>.png` by default; `--out <path>` overrides. `--open` opens the PNG with system viewer post-save.
- **Static social-preview PNG** at `assets/social-preview.png` generated via the same renderer. Embedded at top of README so GitHub renders it on link share. Manual upload to Settings → Social preview still required (queued).
- **Achievement system** (`src/achievements.ts`): 13 achievements with earned/unearned state plus progress for graduated ones (Hat Trick at 1/3, Marathon at 1/10, Saved a Month at N/30 days, etc.). Surfaced in `twoweeks history` with a dedicated section. Earned achievements show ✓ + description; in-progress show ○ + (N/goal). Also returned in `--json` history output for scripting.
- **`bun build --target=node --packages=external`** strategy: satori and @resvg/resvg-js are native/WASM deps that can't be bundled into a single JS file. Marking packages external means npm-installed users get them via dependency resolution at install time. The dist/cli.js stays small (41KB) and ships only user code; deps live in node_modules.
- **package.json**: bumped to 0.4.0. Added `satori` and `@resvg/resvg-js` to dependencies. `files` field still ships `dist/` — npm install pulls in the deps via the dependencies field.
- **README rewrite**: brag card screenshot section, achievements section, screenshot command docs, `--out` and `--open` flags, achievements callout in scripting section, social-preview embedded.

Deferred (queued items because they need credentials, payment, or human action):
- **Upload social-preview.png to GitHub Settings → Social preview** (30-second manual click)
- **Domain `twoweeks.dev`** (registration + DNS, $12/yr)
- **Landing page deployment** (Vercel, needs user's account)
- **Real AI hookup (`twoweeks ask claude`)** — needs Anthropic API key from user
- **`twoweeks.dev/c/<id>` share URL system** — needs deployed backend (Vercel + KV)
- **Opt-in telemetry endpoint** — same backend requirement
- **VS Code / Cursor extension** — 3-day build + marketplace review cycle
- **npm publish** — needs `npm login` from user
- **Newsletter submissions** — human submission required
- **Sticker order** — $50 + shipping from user
- **Show HN / Reddit / Product Hunt posts** — human submission required, timing matters

Released:
- v0.4.0 tag with dist/cli.js attached to GitHub Release
- Homebrew tap at github.com/Meliwat/homebrew-twoweeks

This is the 5→6 push, executed in one autopilot run instead of the 60-day plan I originally wrote.

