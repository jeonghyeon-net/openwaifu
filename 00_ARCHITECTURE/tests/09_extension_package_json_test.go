package tests

import (
  "encoding/json"
  "os"
  "path/filepath"
  "testing"
)

var extensionPackageJSONAllowedKeys = map[string]bool{
  "pi": true,
  "scripts": true,
  "devDependencies": true,
}

func TestExtension_PackageJSON_AllowedKeysOnly(t *testing.T) {
  dir := filepath.Join(repoRoot(t), "02_EXTENSIONS")
  entries, err := os.ReadDir(dir)
  if err != nil { t.Fatalf("02_EXTENSIONS 읽기 실패: %v", err) }
  for _, entry := range entries {
    if !entry.IsDir() { continue }
    t.Run(entry.Name(), func(t *testing.T) {
      raw, err := os.ReadFile(filepath.Join(dir, entry.Name(), "package.json"))
      if err != nil { t.Fatalf("package.json 읽기 실패: %v", err) }
      var pkg map[string]json.RawMessage
      if err := json.Unmarshal(raw, &pkg); err != nil { t.Fatalf("package.json 파싱 실패: %v", err) }
      for key := range pkg {
        if !extensionPackageJSONAllowedKeys[key] { t.Errorf("허용되지 않은 키: %s", key) }
      }

      var parsed struct {
        Pi struct{ Extensions []string `json:"extensions"` } `json:"pi"`
        Scripts map[string]string `json:"scripts"`
      }
      if err := json.Unmarshal(raw, &parsed); err != nil { t.Fatalf("package.json 재파싱 실패: %v", err) }
      if len(parsed.Pi.Extensions) != 1 || parsed.Pi.Extensions[0] != "dist/index.js" {
        t.Errorf("pi.extensions는 [\"dist/index.js\"]여야 함: %v", parsed.Pi.Extensions)
      }
      if parsed.Scripts["test"] == "" { t.Error("scripts.test 필드 누락") }
    })
  }
}
