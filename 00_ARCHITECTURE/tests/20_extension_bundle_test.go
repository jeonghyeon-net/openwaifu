package tests

import (
  "encoding/json"
  "os"
  "path/filepath"
  "strings"
  "testing"
)

func TestExtension_NoDependencies(t *testing.T) {
  for _, entry := range extensionEntries(t) {
    raw, err := os.ReadFile(filepath.Join(extensionRoot(t), entry.Name(), "package.json"))
    if err != nil { t.Fatalf("package.json 읽기 실패: %v", err) }
    var pkg map[string]json.RawMessage
    if err := json.Unmarshal(raw, &pkg); err != nil { t.Fatalf("package.json 파싱 실패: %v", err) }
    if _, ok := pkg["dependencies"]; ok { t.Error("dependencies 금지: devDependencies만 허용") }
  }
}

func TestExtension_EsbuildBundle(t *testing.T) {
  for _, entry := range extensionEntries(t) {
    raw, err := os.ReadFile(filepath.Join(extensionRoot(t), entry.Name(), "package.json"))
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
  for _, entry := range extensionEntries(t) {
    files, err := os.ReadDir(filepath.Join(extensionRoot(t), entry.Name(), "dist"))
    if err != nil { t.Fatalf("dist/ 읽기 실패: %v", err) }
    for _, file := range files {
      if file.Name() != "index.js" { t.Errorf("dist/index.js 외 파일 금지: %s", file.Name()) }
    }
  }
}
