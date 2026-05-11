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
