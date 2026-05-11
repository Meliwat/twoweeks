#!/bin/bash
# Demo script for twoweeks — runs the lifecycle with deliberate pacing for asciinema recording.
# Usage: asciinema rec --command "bash assets/demo.sh" assets/demo.cast
export PATH="$HOME/.bun/bin:$PATH"
cd "$(dirname "$0")/.."

# Start clean
rm -rf ~/.twoweeks 2>/dev/null

echo "$ # Ask Claude: how long to build a pomodoro CLI?"
sleep 1.5
echo "$ # Claude: 'About 2 weeks of focused work.'"
sleep 2

echo ""
echo "$ twoweeks \"build a pomodoro CLI\""
sleep 0.8
bun run cli "build a pomodoro CLI"
sleep 2

echo ""
echo "$ twoweeks"
sleep 0.8
bun run cli
sleep 2

echo ""
echo "$ # ...actually building the thing in Claude Code..."
sleep 1.4
echo "$ # ...pomodoro CLI is now functional..."
sleep 1.4

echo ""
echo "$ twoweeks ship"
sleep 0.8
bun run cli ship
sleep 3
