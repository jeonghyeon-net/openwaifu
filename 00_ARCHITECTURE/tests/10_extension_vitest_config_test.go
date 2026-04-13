package tests

import (
  "os"
  "path/filepath"
  "regexp"
  "strings"
  "testing"
)

var thresholdKeys = []string{"lines", "branches", "functions", "statements"}
var threshold100Re = regexp.MustCompile(`:\s*100\b`)

func TestExtension_VitestConfig_Thresholds(t *testing.T) {
  dir := filepath.Join(repoRoot(t), "02_EXTENSIONS")
  entries, err := os.ReadDir(dir)
  if err != nil { t.Fatalf("02_EXTENSIONS 읽기 실패: %v", err) }
  for _, entry := range entries {
    if !entry.IsDir() { continue }
    data, err := os.ReadFile(filepath.Join(dir, entry.Name(), "vitest.config.ts"))
    if err != nil { t.Fatalf("vitest.config.ts 읽기 실패: %v", err) }
    content := string(data)
    if !strings.Contains(content, "thresholds") { t.Fatal("thresholds 설정이 없음") }
    if !strings.Contains(content, "include") { t.Fatal("coverage.include 설정이 없음") }
    for _, key := range thresholdKeys {
      re := regexp.MustCompile(key + `\s*` + threshold100Re.String())
      if !re.MatchString(content) { t.Errorf("%s: 100이 아니거나 누락됨", key) }
    }
  }
}
