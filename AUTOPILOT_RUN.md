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

