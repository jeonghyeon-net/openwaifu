package tests

import (
  "os"
  "path/filepath"
  "testing"
)

var botRequiredPaths = []string{
  "01_BOT/package.json",
  "01_BOT/tsconfig.json",
  "01_BOT/README",
  "01_BOT/src/main.ts",
}

func TestBot_RequiredFiles(t *testing.T) {
  for _, relativePath := range botRequiredPaths {
    if _, err := os.Stat(filepath.Join(repoRoot(t), relativePath)); os.IsNotExist(err) {
      t.Errorf("필수 파일 누락: %s", relativePath)
    }
  }
}
