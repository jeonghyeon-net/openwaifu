package tests

import (
  "os"
  "path/filepath"
  "regexp"
  "testing"
)

var excludeLineRe = regexp.MustCompile(`exclude\s*:\s*\[`)
var indexOnlyRe = regexp.MustCompile(`exclude\s*:\s*\[\s*"src/index\.ts"\s*\]`)

func TestExtension_VitestConfig_ExcludeOnlyIndex(t *testing.T) {
  dir := filepath.Join(repoRoot(t), "02_EXTENSIONS")
  entries, err := os.ReadDir(dir)
  if err != nil { t.Fatalf("02_EXTENSIONS 읽기 실패: %v", err) }
  for _, entry := range entries {
    if !entry.IsDir() { continue }
    data, err := os.ReadFile(filepath.Join(dir, entry.Name(), "vitest.config.ts"))
    if err != nil { t.Fatalf("vitest.config.ts 읽기 실패: %v", err) }
    content := string(data)
    if !excludeLineRe.MatchString(content) { t.Fatal("coverage.exclude 설정이 없음") }
    if !indexOnlyRe.MatchString(content) { t.Error("coverage.exclude는 [\"src/index.ts\"]만 허용") }
  }
}
