# Skill System Design

## Goal

봇이 Claude Code / Codex 표준 skill 파일을 로드하고, MCP tool을 통해 skill을 생성/수정/삭제할 수 있게 한다.

## Architecture

skill 파일은 Claude Code plugin 표준 구조(`plugins/openwaifu/skills/{name}/SKILL.md`)로 저장. Claude Code는 SDK `plugins` 옵션으로 네이티브 로딩, Codex는 심볼릭 링크로 자동 발견. MCP 서버가 skill CRUD를 제공하고, Claude Code는 `fs.watch` + `reloadPlugins()`로 런타임 리로드.

## Directory Structure

```
plugins/openwaifu/
  .claude-plugin/
    plugin.json           # { "name": "openwaifu", ... }
  skills/
    {skill-name}/
      SKILL.md            # frontmatter(name, description) + markdown 본문
```

## SKILL.md Format

```markdown
---
name: skill-name
description: "한 줄 설명"
---

# Skill Title

skill 본문 (프롬프트 템플릿)
```

## SDK Loading

- **Claude Code**: `plugins: [{ type: 'local', path: './plugins/openwaifu' }]` in query options
- **Codex**: `~/.agents/skills/openwaifu` → `plugins/openwaifu/skills` 심볼릭 링크. 매 턴마다 디스크에서 자동 읽음.

## MCP Server (`mcps/skills/`)

| Tool | Input | Description |
|------|-------|-------------|
| `create_skill` | name, description, content | `skills/{name}/SKILL.md` 생성 |
| `update_skill` | name, description?, content? | SKILL.md 수정 |
| `delete_skill` | name | 폴더 삭제 |
| `list_skills` | - | 전체 목록 반환 |

## Reload

- **Claude Code**: `fs.watch('plugins/openwaifu/skills/')` → 변경 감지 → `query.reloadPlugins()` 호출. watch는 `ClaudeCodeBot` 내부에서 관리.
- **Codex**: 불필요. 매 턴마다 디스크에서 읽음.

## Setup Script (`scripts/setup.sh`)

Codex용 심볼릭 링크 생성:
```bash
mkdir -p ~/.agents/skills
ln -sf "$(pwd)/plugins/openwaifu/skills" ~/.agents/skills/openwaifu
```

## Scope Out

- Skill marketplace / 원격 skill
- Skill 버전 관리
- Skill 의존성
