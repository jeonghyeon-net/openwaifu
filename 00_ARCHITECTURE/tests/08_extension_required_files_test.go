package tests

import (
  "os"
  "path/filepath"
  "testing"
)

var extensionRequiredFiles = []string{
  "package.json",
  "tsconfig.json",
  "biome.json",
  ".gitignore",
  "README",
  "vitest.config.ts",
  "src/index.ts",
  "dist/index.js",
  "tests",
}

func TestExtension_RequiredFiles(t *testing.T) {
  dir := filepath.Join(repoRoot(t), "02_EXTENSIONS")
  entries, err := os.ReadDir(dir)
  if err != nil {
    t.Fatalf("02_EXTENSIONS 읽기 실패: %v", err)
  }
  for _, entry := range entries {
    if !entry.IsDir() {
      continue
    }
    t.Run(entry.Name(), func(t *testing.T) {
      for _, required := range extensionRequiredFiles {
        path := filepath.Join(dir, entry.Name(), required)
        if _, err := os.Stat(path); os.IsNotExist(err) {
          t.Errorf("필수 파일 누락: %s", required)
        }
      }
    })
  }
}
