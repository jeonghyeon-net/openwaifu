package tests

import (
  "os"
  "path/filepath"
  "testing"
)

var root string

func repoRoot(t *testing.T) string {
  t.Helper()

  if root != "" {
    return root
  }

  cwd, err := os.Getwd()
  if err != nil {
    t.Fatalf("작업 디렉터리 읽기 실패: %v", err)
  }

  root = filepath.Clean(filepath.Join(cwd, "../.."))
  return root
}

func TestInit_RepoRootExists(t *testing.T) {
  if _, err := os.Stat(repoRoot(t)); err != nil {
    t.Fatalf("레포 루트 확인 실패: %v", err)
  }
}
