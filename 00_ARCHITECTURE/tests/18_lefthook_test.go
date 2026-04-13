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
    "npm run check",
    "npm run test",
    "npx biome check --error-on-warnings .",
    "pre-push:",
    "npm run build",
    "git add 02_EXTENSIONS/*/dist/",
  }

  for _, snippet := range requiredSnippets {
    if !strings.Contains(content, snippet) {
      t.Errorf("lefthook.yml 필수 구문 누락: %s", snippet)
    }
  }
}
