package tests

import (
  "os"
  "path/filepath"
  "regexp"
  "testing"
)

var testsFilePattern = regexp.MustCompile(`^\d{2}_.+_test\.go$`)

func TestTestsDir_OnlyPrefixedTestFiles(t *testing.T) {
  entries, err := os.ReadDir(filepath.Join(repoRoot(t), "00_ARCHITECTURE", "tests"))
  if err != nil {
    t.Fatalf("tests 디렉터리 읽기 실패: %v", err)
  }
  for _, entry := range entries {
    name := entry.Name()
    if entry.IsDir() {
      t.Errorf("허용되지 않은 디렉터리: %s", name)
      continue
    }
    if name == "go.mod" {
      continue
    }
    if !testsFilePattern.MatchString(name) {
      t.Errorf("허용되지 않은 파일: %s", name)
    }
  }
}
