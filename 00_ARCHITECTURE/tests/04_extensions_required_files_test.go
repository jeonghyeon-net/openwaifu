package tests

import (
  "encoding/json"
  "os"
  "path/filepath"
  "testing"
)

var extensionRequiredPaths = []string{
  "package.json",
  "tsconfig.json",
  "README",
  "src/index.ts",
  "tests",
}

func TestExtensions_RequiredFiles(t *testing.T) {
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
      extensionRoot := filepath.Join(dir, entry.Name())

      for _, relativePath := range extensionRequiredPaths {
        if _, err := os.Stat(filepath.Join(extensionRoot, relativePath)); os.IsNotExist(err) {
          t.Errorf("필수 파일 누락: %s", relativePath)
        }
      }

      packageJSONPath := filepath.Join(extensionRoot, "package.json")
      raw, err := os.ReadFile(packageJSONPath)
      if err != nil {
        t.Fatalf("package.json 읽기 실패: %v", err)
      }

      var parsed struct {
        Pi struct {
          Extensions []string `json:"extensions"`
        } `json:"pi"`
      }
      if err := json.Unmarshal(raw, &parsed); err != nil {
        t.Fatalf("package.json 파싱 실패: %v", err)
      }

      if len(parsed.Pi.Extensions) == 0 {
        t.Errorf("pi.extensions 누락")
      }
    })
  }
}
