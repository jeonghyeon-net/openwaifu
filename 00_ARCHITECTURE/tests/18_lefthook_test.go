package tests

import (
  "os"
  "path/filepath"
  "strings"
  "testing"
)

func TestLefthook_HasRequiredCommands(t *testing.T) {
  raw, err := os.ReadFile(filepath.Join(repoRoot(t), "lefthook.yml"))
  if err != nil {
    t.Fatalf("lefthook.yml 읽기 실패: %v", err)
  }

  content := string(raw)
  requiredSnippets := []string{
    "pre-commit:",
    "go test -count=1 ./...",
    "npm run check",
    "npm run test:bot",
    "npx biome check --error-on-warnings .",
    "pre-push:",
    "npm run build",
    "npm run test:extensions",
    "git add 02_EXTENSIONS/*/dist/",
  }

  for _, snippet := range requiredSnippets {
    if !strings.Contains(content, snippet) {
      t.Errorf("lefthook.yml 필수 구문 누락: %s", snippet)
    }
  }
}
