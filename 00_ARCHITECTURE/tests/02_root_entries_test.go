package tests

import (
  "os"
  "testing"
)

var rootAllowed = map[string]bool{
  ".env": true,
  ".env.example": true,
  ".git": true,
  ".gitignore": true,
  ".mise.toml": true,
  ".pi": true,
  "00_ARCHITECTURE": true,
  "01_BOT": true,
  "02_EXTENSIONS": true,
  "03_SKILLS": true,
  "README": true,
  "docs": true,
  "lefthook.yml": true,
  "node_modules": true,
  "package-lock.json": true,
  "package.json": true,
}

func TestRoot_AllowedEntriesOnly(t *testing.T) {
  entries, err := os.ReadDir(repoRoot(t))
  if err != nil {
    t.Fatalf("루트 읽기 실패: %v", err)
  }
  for _, entry := range entries {
    if !rootAllowed[entry.Name()] {
      t.Errorf("허용되지 않은 루트 항목: %s", entry.Name())
    }
  }
}
