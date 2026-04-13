package tests

import (
  "os"
  "path/filepath"
  "regexp"
  "strings"
  "testing"
)

var sectionToDir = map[string]string{"EXTENSIONS": "02_EXTENSIONS", "SKILLS": "03_SKILLS"}
var itemLineRe = regexp.MustCompile(`^\s{4}(\S+)`)
var descLineRe = regexp.MustCompile(`^\s{4}\S+\s+…\s+\S`)
var sectionRe = regexp.MustCompile(`^\s{2}([A-Z-]+)\s*$`)
var noneRe = regexp.MustCompile(`^\s{4}\(none\)\s*$`)

func readmeLines(t *testing.T) []string {
  t.Helper()
  raw, err := os.ReadFile(filepath.Join(repoRoot(t), "README"))
  if err != nil {
    t.Fatalf("README 읽기 실패: %v", err)
  }
  return strings.Split(string(raw), "\n")
}

func TestReadme_SectionsMatchDisk(t *testing.T) {
  lines := readmeLines(t)
  for section, dir := range sectionToDir {
    readmeItems := parseReadmeSection(lines, section)
    diskItems := listDiskItems(t, dir)
    for item := range readmeItems {
      if !diskItems[item] {
        t.Errorf("README에 있지만 디스크에 없음: %s", item)
      }
    }
    for item := range diskItems {
      if !readmeItems[item] {
        t.Errorf("디스크에 있지만 README에 없음: %s", item)
      }
    }
  }
}

func TestReadme_ItemsHaveDescription(t *testing.T) {
  lines := readmeLines(t)
  for section := range sectionToDir {
    inSection := false
    for _, line := range lines {
      if m := sectionRe.FindStringSubmatch(line); m != nil {
        if m[1] == section { inSection = true; continue }
        if inSection { break }
      }
      if inSection && noneRe.MatchString(line) {
        break
      }
      if inSection && itemLineRe.MatchString(line) && !descLineRe.MatchString(line) {
        t.Errorf("설명 누락: %s", strings.TrimSpace(line))
      }
    }
  }
}

func parseReadmeSection(lines []string, section string) map[string]bool {
  items, inSection := map[string]bool{}, false
  for _, line := range lines {
    if m := sectionRe.FindStringSubmatch(line); m != nil {
      if m[1] == section { inSection = true; continue }
      if inSection { break }
    }
    if inSection {
      if noneRe.MatchString(line) { break }
      if m := itemLineRe.FindStringSubmatch(line); m != nil { items[m[1]] = true }
    }
  }
  return items
}

func listDiskItems(t *testing.T, dir string) map[string]bool {
  t.Helper()
  items := map[string]bool{}
  entries, err := os.ReadDir(filepath.Join(repoRoot(t), dir))
  if err != nil { t.Fatalf("%s 읽기 실패: %v", dir, err) }
  for _, entry := range entries {
    if entry.Name() == "README" { continue }
    if entry.IsDir() { items[entry.Name()] = true }
  }
  return items
}
