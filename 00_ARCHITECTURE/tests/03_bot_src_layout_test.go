package tests

import (
  "os"
  "path/filepath"
  "testing"
)

var botSrcAllowed = map[string]bool{
  "config": true,
  "features": true,
  "integrations": true,
  "main.ts": true,
}

func TestBot_SrcAllowedEntriesOnly(t *testing.T) {
  entries, err := os.ReadDir(filepath.Join(repoRoot(t), "01_BOT", "src"))
  if err != nil {
    t.Fatalf("01_BOT/src 읽기 실패: %v", err)
  }

  for _, entry := range entries {
    if !botSrcAllowed[entry.Name()] {
      t.Errorf("허용되지 않은 01_BOT/src 항목: %s", entry.Name())
    }
  }
}
