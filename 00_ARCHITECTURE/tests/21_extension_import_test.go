package tests

import (
  "fmt"
  "os"
  "os/exec"
  "path/filepath"
  "strings"
  "testing"
)

func TestExtension_DistImportableWithoutLocalNodeModules(t *testing.T) {
  nodePath, err := exec.LookPath("node")
  if err != nil { t.Fatalf("node 실행 파일 찾기 실패: %v", err) }
  for _, entry := range extensionEntries(t) {
    if !entry.IsDir() { continue }
    t.Run(entry.Name(), func(t *testing.T) {
      isolatedDir := copyExtensionWithoutNodeModules(t, filepath.Join(extensionRoot(t), entry.Name()))
      distPath := filepath.Join(isolatedDir, "dist", "index.js")
      if _, err := os.Stat(distPath); err != nil { t.Fatalf("dist/index.js 확인 실패: %v", err) }
      script := fmt.Sprintf("import { pathToFileURL } from 'node:url';\nawait import(pathToFileURL(%q).href);", distPath)
      cmd := exec.Command(nodePath, "--input-type=module", "-e", script)
      cmd.Dir = isolatedDir
      cmd.Env = append(os.Environ(), "NODE_PATH=")
      output, err := cmd.CombinedOutput()
      if err != nil {
        t.Fatalf("node_modules 없이 extension import 실패: %v\n%s", err, strings.TrimSpace(string(output)))
      }
    })
  }
}
