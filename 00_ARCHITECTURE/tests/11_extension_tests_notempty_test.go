package tests

import (
  "os"
  "path/filepath"
  "strings"
  "testing"
)

func TestExtension_TestsDir_NotEmpty(t *testing.T) {
  dir := filepath.Join(repoRoot(t), "02_EXTENSIONS")
  entries, err := os.ReadDir(dir)
  if err != nil { t.Fatalf("02_EXTENSIONS 읽기 실패: %v", err) }
  for _, entry := range entries {
    if !entry.IsDir() { continue }
    files, err := os.ReadDir(filepath.Join(dir, entry.Name(), "tests"))
    if err != nil { t.Fatalf("tests/ 읽기 실패: %v", err) }
    found := false
    for _, file := range files {
      if strings.HasSuffix(file.Name(), ".test.ts") { found = true; break }
    }
    if !found { t.Errorf("%s/tests 안에 .test.ts 파일이 없음", entry.Name()) }
  }
}
