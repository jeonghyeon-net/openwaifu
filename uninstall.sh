#!/usr/bin/env bash
set -euo pipefail

# launchd
PLIST_PATH="$HOME/Library/LaunchAgents/com.openwaifu.brain.plist"

if [ -f "$PLIST_PATH" ]; then
  launchctl unload "$PLIST_PATH" 2>/dev/null || true
  rm "$PLIST_PATH"
  echo "Brain service unregistered."
else
  echo "No launchd service registered."
fi

# git hooks
git config --unset core.hooksPath 2>/dev/null || true
echo "Git hooks unregistered."

echo "Uninstall complete."
