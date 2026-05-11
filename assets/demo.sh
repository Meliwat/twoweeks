#!/bin/bash
# Demo script for twoweeks — runs the lifecycle with deliberate pacing.
# Usage: asciinema rec --command "bash assets/demo.sh" assets/demo.cast
export PATH="$HOME/.bun/bin:$PATH"

# Use the globally-linked twoweeks (bun link) so the prompt shows `twoweeks`
# instead of `bun run src/cli.ts`. Falls back to dist if not linked.
TW=$(command -v twoweeks 2>/dev/null)
if [ -z "$TW" ]; then
  cd "$(dirname "$0")/.."
  TW="node ./dist/cli.js"
fi

# Start clean
rm -rf ~/.twoweeks 2>/dev/null

sleep 0.8
echo "$ # Asked Claude: how long to build a pomodoro CLI?"
sleep 1.6
echo "$ # Claude: 'About 2 weeks of focused work.'"
sleep 2.4

echo ""
sleep 0.4
echo "$ twoweeks \"build a pomodoro CLI\""
sleep 1.0
$TW "build a pomodoro CLI"
sleep 2.6

echo "$ # ... an hour of vibe coding later ..."
sleep 2.0

echo ""
sleep 0.4
echo "$ twoweeks ship"
sleep 1.0
$TW ship
sleep 4.5

echo ""
sleep 0.6
echo "$ # 11 million times faster than the AI thought."
sleep 2.5
