#!/bin/bash
# Demo for twoweeks — simulates the auto-capture lifecycle with natural pacing.
# Usage: asciinema rec --cols 100 --rows 30 --command "bash assets/demo.sh" assets/demo.cast
set -e

export PATH="$HOME/.bun/bin:$PATH"

# Prefer the globally linked binary so prompts read `twoweeks` instead of `node dist/...`
TW="$(command -v twoweeks 2>/dev/null || true)"
if [ -z "$TW" ]; then
  cd "$(dirname "$0")/.."
  TW="node ./dist/cli.js"
fi

# Sandbox so the demo never touches the user's real history.
TW_HOME="$(mktemp -d -t twoweeks-demo)"
export TWOWEEKS_HOME="$TW_HOME"
trap 'rm -rf "$TW_HOME"' EXIT

# Per-character typing animation. Variable jitter feels less mechanical.
typewrite() {
  local line="$1"
  local base="${2:-0.022}"
  local i ch
  for ((i = 0; i < ${#line}; i++)); do
    ch="${line:$i:1}"
    printf '%s' "$ch"
    # Pause longer on spaces and punctuation; faster on letters.
    case "$ch" in
      " ") sleep 0.05 ;;
      "," | ".") sleep 0.12 ;;
      *) sleep "$base" ;;
    esac
  done
  echo
}

# 1) Simulated Claude Code session. The user asks for a timeline.
sleep 0.6
printf '\033[36m> \033[0m'
typewrite "I want to build a habit tracker with streaks, push notifications,"
printf '  '
typewrite "and a leaderboard. What's the timeline on this?"
sleep 1.0
echo

# 2) Claude responds with a phased plan that contains a parseable estimate.
sleep 0.4
echo "  Here's the plan:"
sleep 0.5
echo
sleep 0.2
echo "    Weeks 1-2: data model, streaks, basic CRUD"
sleep 0.55
echo "    Weeks 3-4: push notifications via FCM/APNs"
sleep 0.55
echo "    Weeks 5-6: leaderboard with ranked queries"
sleep 0.7
echo
echo "  Roughly 6 weeks of focused work total. I'll start with the schema."
sleep 1.6

# 3) The hook fires invisibly. Pipe the assistant message into watch.
ASSISTANT_TEXT="Here's the plan:
  Weeks 1-2: data model, streaks, basic CRUD
  Weeks 3-4: push notifications via FCM/APNs
  Weeks 5-6: leaderboard with ranked queries

Roughly 6 weeks of focused work total. I'll start with the schema."

echo
echo "$ASSISTANT_TEXT" | $TW watch --task "habit tracker"
sleep 2.4

# 4) Time skip — the user "builds it".
echo
sleep 0.4
echo -e "\033[2m  ... 3 hours of vibe coding later ...\033[0m"
sleep 1.6

# 5) Backdate the session so the brag shows a realistic actual duration.
HISTFILE="$TW_HOME/history.json"
node -e "
const fs = require('fs');
const path = '$HISTFILE';
const data = JSON.parse(fs.readFileSync(path, 'utf-8'));
const session = data.sessions[0];
session.started_at = Date.now() - (3*60*60*1000 + 17*60*1000);
fs.writeFileSync(path, JSON.stringify(data, null, 2));
" >/dev/null

# 6) Ship + open share intent.
echo
printf '$ '
typewrite "twoweeks ship --share"
sleep 0.7
$TW ship --share
sleep 4.5

echo
sleep 0.3
