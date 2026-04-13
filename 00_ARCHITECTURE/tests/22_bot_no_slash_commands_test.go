package tests

import (
  "os"
  "path/filepath"
  "strings"
  "testing"
)

func TestBot_NoSlashCommandArtifacts(t *testing.T) {
  root := filepath.Join(repoRoot(t), "01_BOT", "src")
  forbidden := []string{"SlashCommandBuilder", ".commands.set(", "isChatInputCommand("}

  err := filepath.Walk(root, func(path string, info os.FileInfo, err error) error {
    if err != nil {
      return err
    }
    if info.IsDir() || !strings.HasSuffix(path, ".ts") {
      return nil
    }

    raw, readErr := os.ReadFile(path)
    if readErr != nil {
      t.Errorf("읽기 실패: %s", path)
      return nil
    }

    content := string(raw)
    for _, token := range forbidden {
      if strings.Contains(content, token) {
        t.Errorf("슬래시 커맨드 흔적 금지: %s in %s", token, path)
      }
    }
    return nil
  })

  if err != nil {
    t.Fatalf("01_BOT/src 검사 실패: %v", err)
  }
}
