package tests

import (
  "encoding/json"
  "os"
  "path/filepath"
  "strings"
  "testing"
)

func TestExtension_NoDependencies(t *testing.T) {
  dir := filepath.Join(repoRoot(t), "02_EXTENSIONS")
  entries, err := os.ReadDir(dir)
  if err != nil { t.Fatalf("02_EXTENSIONS 읽기 실패: %v", err) }
  for _, entry := range entries {
    if !entry.IsDir() { continue }
    raw, err := os.ReadFile(filepath.Join(dir, entry.Name(), "package.json"))
    if err != nil { t.Fatalf("package.json 읽기 실패: %v", err) }
    var pkg map[string]json.RawMessage
    if err := json.Unmarshal(raw, &pkg); err != nil { t.Fatalf("package.json 파싱 실패: %v", err) }
    if _, ok := pkg["dependencies"]; ok { t.Error("dependencies 금지: devDependencies만 허용") }
  }
}

func TestExtension_EsbuildBundle(t *testing.T) {
  dir := filepath.Join(repoRoot(t), "02_EXTENSIONS")
  entries, err := os.ReadDir(dir)
  if err != nil { t.Fatalf("02_EXTENSIONS 읽기 실패: %v", err) }
  for _, entry := range entries {
    if !entry.IsDir() { continue }
    raw, err := os.ReadFile(filepath.Join(dir, entry.Name(), "package.json"))
    if err != nil { t.Fatalf("package.json 읽기 실패: %v", err) }
    var pkg struct{ Scripts map[string]string `json:"scripts"` }
    if err := json.Unmarshal(raw, &pkg); err != nil { t.Fatalf("package.json 파싱 실패: %v", err) }
    build := pkg.Scripts["build"]
    if !strings.Contains(build, "esbuild") || !strings.Contains(build, "--bundle") {
      t.Errorf("build 스크립트에 esbuild --bundle 필수: %s", build)
    }
  }
}

func TestExtension_DistSingleFile(t *testing.T) {
  dir := filepath.Join(repoRoot(t), "02_EXTENSIONS")
  entries, err := os.ReadDir(dir)
  if err != nil { t.Fatalf("02_EXTENSIONS 읽기 실패: %v", err) }
  for _, entry := range entries {
    if !entry.IsDir() { continue }
    files, err := os.ReadDir(filepath.Join(dir, entry.Name(), "dist"))
    if err != nil { t.Fatalf("dist/ 읽기 실패: %v", err) }
    for _, file := range files {
      if file.Name() != "index.js" { t.Errorf("dist/index.js 외 파일 금지: %s", file.Name()) }
    }
  }
}
