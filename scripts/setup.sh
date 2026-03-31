#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
SKILLS_DIR="$ROOT_DIR/skills"

# Codex: symlink skills to ~/.agents/skills/openwaifu
mkdir -p ~/.agents/skills
ln -sf "$SKILLS_DIR" ~/.agents/skills/openwaifu
echo "Linked $SKILLS_DIR → ~/.agents/skills/openwaifu"

# Install dependencies
cd "$ROOT_DIR"
bun install
echo "Done."
