package tests

import (
  "encoding/json"
  "os"
  "path/filepath"
  "testing"
)

var packageJSONAllowedKeys = map[string]bool{
  "private": true,
  "scripts": true,
  "workspaces": true,
}

func TestPackageJSON_AllowedKeysOnly(t *testing.T) {
  raw, err := os.ReadFile(filepath.Join(repoRoot(t), "package.json"))
  if err != nil {
    t.Fatalf("package.json 읽기 실패: %v", err)
  }

  var pkg map[string]json.RawMessage
  if err := json.Unmarshal(raw, &pkg); err != nil {
    t.Fatalf("package.json 파싱 실패: %v", err)
  }
  for key := range pkg {
    if !packageJSONAllowedKeys[key] {
      t.Errorf("허용되지 않은 키: %s", key)
    }
  }

  var parsed struct {
    Scripts    map[string]string `json:"scripts"`
    Workspaces []string          `json:"workspaces"`
  }
  if err := json.Unmarshal(raw, &parsed); err != nil {
    t.Fatalf("package.json 재파싱 실패: %v", err)
  }

  for _, script := range []string{"setup", "dev", "start", "check", "test:arch", "test:extensions"} {
    if parsed.Scripts[script] == "" {
      t.Errorf("필수 스크립트 누락: %s", script)
    }
  }

  requiredWorkspaces := []string{"01_BOT", "02_EXTENSIONS/*"}
  for _, workspace := range requiredWorkspaces {
    found := false
    for _, item := range parsed.Workspaces {
      if item == workspace {
        found = true
        break
      }
    }
    if !found {
      t.Errorf("필수 workspace 누락: %s", workspace)
    }
  }
}
