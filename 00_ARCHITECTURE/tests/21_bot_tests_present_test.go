package tests

import (
  "os"
  "path/filepath"
  "strings"
  "testing"
)

func TestBot_TestsDir_HasTestFiles(t *testing.T) {
  dir := filepath.Join(repoRoot(t), "01_BOT", "tests")
  files, err := os.ReadDir(dir)
  if err != nil {
    t.Fatalf("01_BOT/tests 읽기 실패: %v", err)
  }

  found := false
  for _, file := range files {
    if strings.HasSuffix(file.Name(), ".test.ts") {
      found = true
      break
    }
  }

  if !found {
    t.Fatal("01_BOT/tests 안에 .test.ts 파일이 없음")
  }
}
