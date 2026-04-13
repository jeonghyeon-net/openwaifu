package tests

import (
  "encoding/json"
  "os"
  "path/filepath"
  "testing"
)

func TestRootPackageJSON_HasRequiredScriptsAndWorkspaces(t *testing.T) {
  raw, err := os.ReadFile(filepath.Join(repoRoot(t), "package.json"))
  if err != nil {
    t.Fatalf("package.json 읽기 실패: %v", err)
  }

  var parsed struct {
    Scripts    map[string]string `json:"scripts"`
    Workspaces []string          `json:"workspaces"`
  }
  if err := json.Unmarshal(raw, &parsed); err != nil {
    t.Fatalf("package.json 파싱 실패: %v", err)
  }

  requiredScripts := []string{"dev", "start", "check", "test:arch"}
  for _, script := range requiredScripts {
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
