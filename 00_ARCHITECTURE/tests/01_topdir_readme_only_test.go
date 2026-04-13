package tests

import (
  "os"
  "path/filepath"
  "testing"
)

var readmeOnlyDirs = []string{"00_ARCHITECTURE", "02_EXTENSIONS", "03_SKILLS"}

func TestTopdir_ReadmeOnly(t *testing.T) {
  for _, dir := range readmeOnlyDirs {
    t.Run(dir, func(t *testing.T) {
      entries, err := os.ReadDir(filepath.Join(repoRoot(t), dir))
      if err != nil {
        t.Fatalf("디렉터리 읽기 실패: %v", err)
      }
      for _, entry := range entries {
        if !entry.IsDir() && entry.Name() != "README" {
          t.Errorf("허용되지 않은 파일: %s/%s", dir, entry.Name())
        }
      }
    })
  }
}
