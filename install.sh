#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="$(cd "$(dirname "$0")" && pwd)"

# detect shell rc file
SHELL_RC=""
case "$(basename "$SHELL")" in
  zsh)  SHELL_RC="$HOME/.zshrc" ;;
  bash) SHELL_RC="$HOME/.bashrc" ;;
esac
if [ -z "$SHELL_RC" ]; then
  echo "WARNING: Unsupported shell '$(basename "$SHELL")'. You may need to manually configure brew shellenv and mise activate."
fi

# brew
BREW_PREFIX="/opt/homebrew"
[ -x "/usr/local/bin/brew" ] && BREW_PREFIX="/usr/local"

if ! command -v brew &>/dev/null; then
  echo "Installing Homebrew..."
  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
  eval "$("$BREW_PREFIX/bin/brew" shellenv)"
fi

if [ -n "$SHELL_RC" ] && ! grep -q 'brew shellenv' "$SHELL_RC" 2>/dev/null; then
  echo '' >> "$SHELL_RC"
  echo 'eval "$(/opt/homebrew/bin/brew shellenv 2>/dev/null || /usr/local/bin/brew shellenv)"' >> "$SHELL_RC"
  echo "Added brew shellenv to $SHELL_RC"
fi

# mise
if ! command -v mise &>/dev/null; then
  echo "Installing mise..."
  brew install mise
fi

if [ -n "$SHELL_RC" ] && ! grep -q 'mise activate' "$SHELL_RC" 2>/dev/null; then
  echo '' >> "$SHELL_RC"
  echo 'eval "$(mise activate '"$(basename "$SHELL")"')"' >> "$SHELL_RC"
  echo "Added mise activate to $SHELL_RC"
fi

# runtime
mise trust
mise install
eval "$(mise activate bash)"

# dependencies
bun install

# claude code
if ! command -v claude &>/dev/null; then
  echo "Installing Claude Code..."
  brew install claude-code
fi

# git hooks
git config core.hooksPath .githooks

# codex skill symlink
mkdir -p ~/.agents/skills
SKILL_LINK="$HOME/.agents/skills/openwaifu"
if [ -L "$SKILL_LINK" ] && [ "$(readlink "$SKILL_LINK")" = "$REPO_DIR/skills" ]; then
  echo "Skill symlink already configured."
elif [ -e "$SKILL_LINK" ]; then
  echo "WARNING: $SKILL_LINK already exists ($(readlink "$SKILL_LINK" 2>/dev/null || echo 'not a symlink')). Skipping."
else
  ln -s "$REPO_DIR/skills" "$SKILL_LINK"
  echo "Linked skills → $SKILL_LINK"
fi

# launchd
read -rp "Register brain as launchd service? [y/N] " answer
if [[ "$answer" =~ ^[Yy]$ ]]; then
  PLIST_NAME="com.openwaifu.brain.plist"
  PLIST_PATH="$HOME/Library/LaunchAgents/$PLIST_NAME"
  BUN_PATH="$(mise which bun)"

  mkdir -p "$HOME/Library/LaunchAgents"

  LOG_DIR="$HOME/Library/Logs/openwaifu"
  mkdir -p "$LOG_DIR"

  cat > "$PLIST_PATH" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.openwaifu.brain</string>
    <key>ProgramArguments</key>
    <array>
        <string>${BUN_PATH}</string>
        <string>--env-file=${REPO_DIR}/.env</string>
        <string>--watch</string>
        <string>run</string>
        <string>src/index.ts</string>
    </array>
    <key>WorkingDirectory</key>
    <string>${REPO_DIR}/apps/brain</string>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>${LOG_DIR}/brain.log</string>
    <key>StandardErrorPath</key>
    <string>${LOG_DIR}/brain.err</string>
</dict>
</plist>
EOF

  launchctl unload -w "$PLIST_PATH" 2>/dev/null || true
  launchctl load -w "$PLIST_PATH"
  echo "Brain service registered and started."
fi

echo "Setup complete."
