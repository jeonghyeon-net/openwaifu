# Browser Automation Feature Design

## Overview

openwaifu 봇에 범용 브라우저 조작 기능을 추가한다. 웹 탐색, 로그인/폼 제출, 스크린샷 캡처 및 채팅 전송을 포함한다.

## Scope

1. **`mcps/browser/`** — `@playwright/mcp`를 래핑하는 MCP 서버
2. **이미지 스트리밍 파이프라인** — 도구 결과의 이미지를 채팅으로 전송

## 1. Browser MCP Server (`mcps/browser/`)

### 구조

```
mcps/browser/
├── package.json
├── src/
│   └── index.ts
└── tsconfig.json
```

### 동작

- `@playwright/mcp`의 `createConnection()`으로 Playwright MCP 서버 생성
- `StdioServerTransport`로 연결 (openwaifu MCP 표준 패턴)
- `discoverMcpServers()`가 자동 발견 → brain이 봇에 도구 주입
- headless chromium, 단일 브라우저 인스턴스, 탭으로 동시 작업

### `src/index.ts`

```typescript
import { createConnection } from "@playwright/mcp";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

const server = await createConnection({
  browser: {
    browserName: "chromium",
    launchOptions: { headless: true },
  },
});

await server.connect(new StdioServerTransport());
```

### `package.json`

```json
{
  "name": "@mcp/browser",
  "private": true,
  "type": "module",
  "exports": { ".": "./src/index.ts" },
  "scripts": { "check": "tsc --noEmit" },
  "dependencies": {
    "@playwright/mcp": "*",
    "@modelcontextprotocol/sdk": "^1.29.0"
  },
  "devDependencies": {
    "typescript": "catalog:"
  }
}
```

### 노출되는 주요 도구

`@playwright/mcp` 기본 제공 (별도 등록 불필요):
- `browser_navigate` — URL 이동
- `browser_click` — 요소 클릭
- `browser_fill_form` — 폼 입력
- `browser_take_screenshot` — 스크린샷 (base64 이미지 반환)
- `browser_snapshot` — 접근성 트리 스냅샷
- `browser_evaluate` — JS 실행
- `browser_tabs` — 탭 목록/전환
- 기타 30+ 도구

## 2. Image Streaming Pipeline

### 현재 구조 (text only)

```
Claude Agent SDK → StreamChunk { type: "text" } → sendStream() → 텍스트 메시지
```

### 변경 후 구조

```
Claude Agent SDK → StreamChunk { type: "text" | "image" } → sendStream() → 텍스트 또는 이미지
```

### 변경 파일

#### `libs/llm/src/chatbot.ts`

`StreamChunk` 타입 확장:

```typescript
export type StreamChunk =
  | { type: "text"; text: string }
  | { type: "image"; data: Buffer; mediaType: string };
```

#### `libs/llm/src/claude-code.ts`

`responseStream()` 제너레이터에서 `mcp_tool_result` 이벤트 감지:

```typescript
// content_block_start에서 mcp_tool_result 체크
if (
  msg.type === "stream_event" &&
  msg.event.type === "content_block_start" &&
  msg.event.content_block.type === "mcp_tool_result"
) {
  const content = msg.event.content_block.content;
  if (Array.isArray(content)) {
    for (const block of content) {
      if (block.type === "image" && block.source?.type === "base64") {
        yield {
          type: "image",
          data: Buffer.from(block.source.data, "base64"),
          mediaType: block.source.media_type,
        };
      }
    }
  }
}
```

#### `libs/chat-platform/src/discord.ts`

`sendStream()`에 이미지 분기 추가:

```typescript
if (chunk.type === "image") {
  const ext = chunk.mediaType.split("/")[1] || "png";
  await ch.send({ files: [{ attachment: chunk.data, name: `screenshot.${ext}` }] });
  continue;
}
```

#### `libs/chat-platform/src/telegram.ts`

동일 패턴:

```typescript
if (chunk.type === "image") {
  await bot.api.sendPhoto(chatId, new InputFile(chunk.data, "screenshot.png"));
  continue;
}
```

## Design Decisions

| 결정 | 선택 | 이유 |
|------|------|------|
| 브라우저 패키지 | `@playwright/mcp` 래핑 | 도구가 잘 정의되어 있고 빠르게 구현 가능 |
| 세션 관리 | 단일 브라우저, 탭으로 동시 작업 | `@playwright/mcp` 기본 동작, 쿠키/로그인 상태 유지 |
| 이미지 전달 | base64 → Buffer 변환 후 파일 업로드 | 같은 머신 stdio 통신이라 오버헤드 무시 가능 |
| 헤드리스 모드 | headless: true | 서버 환경에서 GUI 불필요 |
