package tests

import (
  "os"
  "path/filepath"
  "regexp"
  "strings"
  "testing"
)

var extensionAPIRe = regexp.MustCompile(`\bExtensionAPI\b`)

func TestExtension_NoExtensionAPIOutsideIndex(t *testing.T) {
  dir := filepath.Join(repoRoot(t), "02_EXTENSIONS")
  entries, err := os.ReadDir(dir)
  if err != nil { t.Fatalf("02_EXTENSIONS 읽기 실패: %v", err) }
  for _, entry := range entries {
    if !entry.IsDir() { continue }
    filepath.Walk(filepath.Join(dir, entry.Name(), "src"), func(path string, info os.FileInfo, err error) error {
      if err != nil || info.IsDir() || !strings.HasSuffix(info.Name(), ".ts") || info.Name() == "index.ts" { return err }
      data, err := os.ReadFile(path)
      if err != nil { return nil }
      for i, line := range strings.Split(string(data), "\n") {
        if extensionAPIRe.MatchString(line) { t.Errorf("%s:%d ExtensionAPI 사용 금지", path, i+1) }
      }
      return nil
    })
  }
}
