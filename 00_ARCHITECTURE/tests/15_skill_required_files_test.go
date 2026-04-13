package tests

import (
  "os"
  "path/filepath"
  "testing"
)

func TestSkill_RequiredFiles(t *testing.T) {
  dir := filepath.Join(repoRoot(t), "03_SKILLS")
  entries, err := os.ReadDir(dir)
  if err != nil { t.Fatalf("03_SKILLS 읽기 실패: %v", err) }
  for _, entry := range entries {
    if !entry.IsDir() { continue }
    t.Run(entry.Name(), func(t *testing.T) {
      path := filepath.Join(dir, entry.Name(), "SKILL.md")
      if _, err := os.Stat(path); os.IsNotExist(err) {
        t.Errorf("필수 파일 누락: %s", path)
      }
    })
  }
}
