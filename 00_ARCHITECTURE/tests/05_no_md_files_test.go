package tests

import (
  "os"
  "path/filepath"
  "strings"
  "testing"
)

func TestAllFiles_NoMdExtension(t *testing.T) {
  filepath.Walk(repoRoot(t), func(path string, info os.FileInfo, err error) error {
    if err != nil {
      return err
    }
    rel, _ := filepath.Rel(repoRoot(t), path)
    dir := filepath.Base(rel)
    if info.IsDir() {
      if rel == ".git" || dir == "node_modules" || dir == "coverage" {
        return filepath.SkipDir
      }
      return nil
    }
    if !strings.HasSuffix(info.Name(), ".md") {
      return nil
    }
    if strings.HasPrefix(rel, "03_SKILLS/") || strings.HasPrefix(rel, "docs/") {
      return nil
    }
    t.Errorf("허용되지 않은 .md 파일: %s", rel)
    return nil
  })
}
