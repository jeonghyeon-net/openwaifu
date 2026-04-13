package tests

import (
  "encoding/json"
  "os"
  "path/filepath"
  "strings"
  "testing"
)

var botPackageJSONAllowedKeys = map[string]bool{
  "type": true,
  "scripts": true,
  "dependencies": true,
  "devDependencies": true,
}

func TestBot_PackageJSON_Rules(t *testing.T) {
  raw, err := os.ReadFile(filepath.Join(repoRoot(t), "01_BOT", "package.json"))
  if err != nil { t.Fatalf("01_BOT/package.json 읽기 실패: %v", err) }

  var pkg map[string]json.RawMessage
  if err := json.Unmarshal(raw, &pkg); err != nil { t.Fatalf("01_BOT/package.json 파싱 실패: %v", err) }
  for key := range pkg {
    if !botPackageJSONAllowedKeys[key] { t.Errorf("허용되지 않은 키: %s", key) }
  }

  var parsed struct {
    Type string `json:"type"`
    Scripts map[string]string `json:"scripts"`
    DevDependencies map[string]string `json:"devDependencies"`
  }
  if err := json.Unmarshal(raw, &parsed); err != nil { t.Fatalf("01_BOT/package.json 재파싱 실패: %v", err) }
  if parsed.Type != "module" { t.Fatal("01_BOT/package.json type 은 module 이어야 함") }
  if !strings.Contains(parsed.Scripts["test"], "--coverage") { t.Fatal("01_BOT/scripts.test 는 --coverage 를 포함해야 함") }
  if parsed.DevDependencies["@vitest/coverage-v8"] == "" { t.Fatal("@vitest/coverage-v8 누락") }
}
