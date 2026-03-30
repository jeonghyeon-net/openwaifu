#!/usr/bin/env bash
set -euo pipefail

if ! command -v mise &>/dev/null; then
  echo "mise not found. Install it first: https://mise.jdx.dev/getting-started.html"
  exit 1
fi

mise trust
mise install

bun install

git config core.hooksPath .githooks
