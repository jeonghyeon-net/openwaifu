package tests

import (
  "os"
  "path/filepath"
  "strings"
  "testing"
)

func TestSchedulerBundle_NoExternalCronParserImport(t *testing.T) {
  dist := filepath.Join(repoRoot(t), "02_EXTENSIONS", "scheduler", "dist", "index.js")
  raw, err := os.ReadFile(dist)
  if err != nil { t.Fatalf("scheduler dist 읽기 실패: %v", err) }
  text := string(raw)
  for _, banned := range []string{"require(\"cron-parser\")", "from \"cron-parser\"", "from 'cron-parser'"} {
    if strings.Contains(text, banned) {
      t.Fatalf("scheduler bundle 외부 cron-parser import 금지: %s", banned)
    }
  }
}
