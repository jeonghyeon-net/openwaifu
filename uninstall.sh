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

# codex skill symlink
SKILL_LINK="$HOME/.agents/skills/openwaifu"
if [ -L "$SKILL_LINK" ]; then
  rm "$SKILL_LINK"
  echo "Skill symlink removed."
fi

echo "Uninstall complete."
