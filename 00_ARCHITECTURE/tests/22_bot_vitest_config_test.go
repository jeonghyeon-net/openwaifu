package tests

import (
  "os"
  "path/filepath"
  "regexp"
  "strings"
  "testing"
)

func TestBot_VitestConfig_Thresholds(t *testing.T) {
  data, err := os.ReadFile(filepath.Join(repoRoot(t), "01_BOT", "vitest.config.ts"))
  if err != nil { t.Fatalf("vitest.config.ts 읽기 실패: %v", err) }
  content := string(data)
  if !strings.Contains(content, "coverage") { t.Fatal("coverage 설정이 없음") }
  if !strings.Contains(content, "include") { t.Fatal("coverage.include 설정이 없음") }
  if strings.Contains(content, "exclude") { t.Fatal("coverage.exclude 금지") }
  for _, key := range []string{"lines", "branches", "functions", "statements"} {
    re := regexp.MustCompile(key + `\s*:\s*100\b`)
    if !re.MatchString(content) { t.Errorf("%s: 100이 아니거나 누락됨", key) }
  }
}
