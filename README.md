# twoweeks

> Why your AI assistant always says two weeks but you ship by lunch.

A CLI that times the gap between your AI's confident estimate and your actual ship time. Built for the era where "this is a multi-month project" turns into a single Friday afternoon.

```
$ twoweeks "build the auth flow"
⏰ 2 weeks remaining for: build the auth flow
   Your AI is sure of it.

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

Want to brag? Run: twoweeks share 1
```

## Install

**v1 development (requires [Bun](https://bun.sh)):**

```bash
git clone https://github.com/meliwat/twoweeks
cd twoweeks
bun install
bun run cli "build the auth flow"
```

**npm (when published):**

```bash
npx twoweeks "task"
# or
npm install -g twoweeks
twoweeks "task"
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
| `twoweeks abandon` | Abandon the current session (excluded from stats) |

## Flags

| Flag | What it does |
|---|---|
| `--eta "3 months"` | Override the default 2-week ETA when starting |
| `--force` | Start a new session even if one is already active |
| `--help, -h` | Show help |
| `--version, -v` | Show version |

## How it works

Every session gets stamped with an ETA (default: 2 weeks). When you ship, `twoweeks` computes the compression ratio:

```
ratio = round(eta_ms / actual_ms)
```

So a 2-week estimate shipped in 47 minutes is a 425x compression. The CLI then offers to open X with a pre-filled brag for the world to enjoy.

## Storage

Local SQLite at `~/.twoweeks/history.db`. No cloud. No accounts. No telemetry. Your AI's overconfidence stays between you and your terminal.

## License

MIT. Have fun.
