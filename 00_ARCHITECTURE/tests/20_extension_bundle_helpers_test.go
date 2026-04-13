package tests

import (
  "io/fs"
  "os"
  "path/filepath"
  "testing"
)

func extensionRoot(t *testing.T) string {
  t.Helper()
  return filepath.Join(repoRoot(t), "02_EXTENSIONS")
}

func extensionEntries(t *testing.T) []os.DirEntry {
  t.Helper()
  entries, err := os.ReadDir(extensionRoot(t))
  if err != nil { t.Fatalf("02_EXTENSIONS 읽기 실패: %v", err) }
  filtered := make([]os.DirEntry, 0, len(entries))
  for _, entry := range entries {
    if entry.IsDir() { filtered = append(filtered, entry) }
  }
  return filtered
}

func copyExtensionWithoutNodeModules(t *testing.T, srcDir string) string {
  t.Helper()
  dstDir := filepath.Join(t.TempDir(), filepath.Base(srcDir))
  err := filepath.WalkDir(srcDir, func(path string, d fs.DirEntry, err error) error {
    if err != nil { return err }
    rel, err := filepath.Rel(srcDir, path)
    if err != nil { return err }
    if rel == "." { return os.MkdirAll(dstDir, 0o755) }
    if rel == "node_modules" && d.IsDir() { return filepath.SkipDir }
    dstPath := filepath.Join(dstDir, rel)
    if d.IsDir() { return os.MkdirAll(dstPath, 0o755) }
    raw, err := os.ReadFile(path)
    if err != nil { return err }
    return os.WriteFile(dstPath, raw, 0o644)
  })
  if err != nil { t.Fatalf("extension 복사 실패: %v", err) }
  return dstDir
}
