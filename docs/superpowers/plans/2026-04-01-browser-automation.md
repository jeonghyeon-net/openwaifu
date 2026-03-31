# Browser Automation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** openwaifu 봇에 범용 브라우저 조작 기능을 추가하고, 스크린샷을 채팅으로 전송할 수 있도록 이미지 스트리밍 파이프라인을 구축한다.

**Architecture:** `@playwright/mcp`를 래핑하는 MCP 서버를 `mcps/browser/`에 생성하여 기존 자동 발견 메커니즘으로 brain에 연결한다. `StreamChunk` 타입을 확장하고, 스트림에서 MCP 도구 결과의 이미지를 감지하여 Discord/Telegram으로 전송한다.

**Tech Stack:** `@playwright/mcp`, `@modelcontextprotocol/sdk`, discord.js, grammy

**Spec:** `docs/superpowers/specs/2026-04-01-browser-automation-design.md`

---

## File Structure

| Action | Path | Responsibility |
|--------|------|---------------|
| Create | `mcps/browser/package.json` | 패키지 정의, 의존성 |
| Create | `mcps/browser/tsconfig.json` | TypeScript 설정 |
| Create | `mcps/browser/src/index.ts` | @playwright/mcp 래핑 + stdio 연결 |
| Modify | `libs/llm/src/chatbot.ts:11` | StreamChunk에 image 타입 추가 |
| Modify | `libs/chat-platform/src/platform.ts:34-37` | sendStream 시그니처에 image 타입 추가 |
| Modify | `libs/llm/src/claude-code.ts:261-293` | mcp_tool_result에서 이미지 감지 → yield |
| Modify | `libs/chat-platform/src/discord.ts:129-185` | sendStream에서 image chunk 처리 |
| Modify | `libs/chat-platform/src/telegram.ts:120-174` | sendStream에서 image chunk 처리 |

---

### Task 1: Create `mcps/browser/` MCP Server Package

**Files:**
- Create: `mcps/browser/package.json`
- Create: `mcps/browser/tsconfig.json`
- Create: `mcps/browser/src/index.ts`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "@mcp/browser",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/index.ts"
  },
  "scripts": {
    "check": "bunx tsc --noEmit"
  },
  "dependencies": {
    "@playwright/mcp": "*"
  }
}
```

- [ ] **Step 2: Create tsconfig.json**

```json
{
  "extends": "../../tsconfig.base.json"
}
```

- [ ] **Step 3: Create src/index.ts**

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

- [ ] **Step 4: Install dependencies**

Run: `cd /Users/me/Desktop/openwaifu && bun install`

- [ ] **Step 5: Verify type check**

Run: `cd /Users/me/Desktop/openwaifu/mcps/browser && bunx tsc --noEmit`
Expected: No errors (or only warnings about @playwright/mcp types — fix as needed)

- [ ] **Step 6: Verify auto-discovery**

Confirm that `discoverMcpServers()` in `libs/mcp-discovery/src/index.ts` will pick up the new server:
- `mcps/browser/package.json` has `exports["."]` = `"./src/index.ts"` ✓
- Discovery maps to `{ command: "bun", args: ["run", "<path>/mcps/browser/src/index.ts"] }` ✓

- [ ] **Step 7: Commit**

```bash
git add mcps/browser/
git commit -m "feat: add browser MCP server wrapping @playwright/mcp"
```

---

### Task 2: Extend StreamChunk Type and sendStream Signature

**Files:**
- Modify: `libs/llm/src/chatbot.ts:11`
- Modify: `libs/chat-platform/src/platform.ts:34-37`

- [ ] **Step 1: Extend StreamChunk in chatbot.ts**

In `libs/llm/src/chatbot.ts`, change line 11 from:

```typescript
export type StreamChunk = { type: "text"; text: string };
```

to:

```typescript
export type StreamChunk =
	| { type: "text"; text: string }
	| { type: "image"; data: Buffer; mediaType: string };
```

- [ ] **Step 2: Update sendStream signature in platform.ts**

In `libs/chat-platform/src/platform.ts`, change lines 34-37 from:

```typescript
abstract sendStream(
    channelId: string,
    stream: AsyncIterable<{ type: "text"; text: string }>,
): Promise<void>;
```

to:

```typescript
abstract sendStream(
    channelId: string,
    stream: AsyncIterable<
        | { type: "text"; text: string }
        | { type: "image"; data: Buffer; mediaType: string }
    >,
): Promise<void>;
```

Note: 타입을 인라인으로 정의한다. `platform.ts`는 `@lib/llm`에 의존하지 않으므로 import하지 않는다.

- [ ] **Step 3: Update sendStream signature in discord.ts**

In `libs/chat-platform/src/discord.ts`, change line 131 from:

```typescript
stream: AsyncIterable<{ type: "text"; text: string }>,
```

to:

```typescript
stream: AsyncIterable<
    | { type: "text"; text: string }
    | { type: "image"; data: Buffer; mediaType: string }
>,
```

- [ ] **Step 4: Update sendStream signature in telegram.ts**

In `libs/chat-platform/src/telegram.ts`, change line 122 from:

```typescript
stream: AsyncIterable<{ type: "text"; text: string }>,
```

to:

```typescript
stream: AsyncIterable<
    | { type: "text"; text: string }
    | { type: "image"; data: Buffer; mediaType: string }
>,
```

- [ ] **Step 5: Verify type check passes**

Run: `cd /Users/me/Desktop/openwaifu && bun --filter '*' check`
Expected: All packages pass type checking. Discord/Telegram implementations compile because existing code only accesses `chunk.text` which is valid for the text variant.

- [ ] **Step 6: Commit**

```bash
git add libs/llm/src/chatbot.ts libs/chat-platform/src/platform.ts libs/chat-platform/src/discord.ts libs/chat-platform/src/telegram.ts
git commit -m "feat: extend StreamChunk and sendStream to support image type"
```

---

### Task 3: Add Image Detection in claude-code.ts

**Files:**
- Modify: `libs/llm/src/claude-code.ts:261-293`

SDK 타입 참고: `BetaMCPToolResultBlock.content`의 TypeScript 타입은 `string | Array<BetaTextBlock>`이지만, 런타임에 MCP 서버가 반환한 이미지 콘텐츠가 포함될 수 있다. 런타임 타입 체크로 이미지를 감지한다.

- [ ] **Step 1: Add image extraction logic to responseStream()**

In `libs/llm/src/claude-code.ts`, find the `responseStream()` generator (line 261). After the existing tool_use detection block (lines 273-280), add image extraction:

```typescript
async function* responseStream() {
    let hadTool = false;

    for (;;) {
        if (self.turnId !== myTurn) return;
        const msg = await pump.pull();
        if (msg === null) return;

        if (msg.type === "system" && msg.subtype === "init") {
            self._sessionId = msg.session_id;
        }

        // tool 호출 감지
        if (
            msg.type === "stream_event" &&
            msg.event.type === "content_block_start" &&
            msg.event.content_block.type === "tool_use"
        ) {
            hadTool = true;
        }

        // MCP 도구 결과에서 이미지 감지
        if (
            msg.type === "stream_event" &&
            msg.event.type === "content_block_start" &&
            msg.event.content_block.type === "mcp_tool_result"
        ) {
            hadTool = true;
            const content = msg.event.content_block.content;
            if (Array.isArray(content)) {
                for (const block of content) {
                    const b = block as Record<string, unknown>;
                    if (
                        b["type"] === "image" &&
                        typeof b["source"] === "object" &&
                        b["source"] !== null &&
                        (b["source"] as Record<string, unknown>)["type"] === "base64"
                    ) {
                        const src = b["source"] as Record<string, unknown>;
                        yield {
                            type: "image" as const,
                            data: Buffer.from(src["data"] as string, "base64"),
                            mediaType: (src["media_type"] as string) ?? "image/png",
                        };
                    }
                }
            }
        }

        const text = isTextDelta(msg);
        if (text) {
            // tool 호출 후 첫 텍스트 → 줄바꿈으로 구분
            if (hadTool) {
                hadTool = false;
                yield { type: "text" as const, text: "\n" };
            }
            yield { type: "text" as const, text };
        }
        if (msg.type === "result") return;
    }
}
```

핵심: `block as Record<string, unknown>`으로 런타임 타입 체크. TypeScript 타입에 image가 없더라도 런타임에 존재하면 감지한다. 존재하지 않으면 조건문이 false가 되어 무시된다.

- [ ] **Step 2: Verify type check**

Run: `cd /Users/me/Desktop/openwaifu && bun --filter '@lib/llm' check`
Expected: Pass

- [ ] **Step 3: Commit**

```bash
git add libs/llm/src/claude-code.ts
git commit -m "feat: detect and yield images from MCP tool results"
```

---

### Task 4: Add Image Sending in Discord

**Files:**
- Modify: `libs/chat-platform/src/discord.ts:129-185`

- [ ] **Step 1: Modify sendStream to handle image chunks**

현재 `sendStream` 메서드의 for 루프 내부에서 chunk를 처리하는 부분을 수정한다. 현재 코드는 `winner.result.value.text`로 텍스트에 직접 접근하는데, image chunk도 처리해야 한다.

In `libs/chat-platform/src/discord.ts`, replace the body of the `for(;;)` loop in `sendStream` (lines 159-182) with:

```typescript
for (;;) {
    const winner = await Promise.race([
        next.then((r) => ({ type: "chunk" as const, result: r })),
        tick.then(() => ({ type: "tick" as const, result: null })),
    ]);

    if (winner.type === "tick") {
        await flush();
        tick = delay();
        continue;
    }

    if (winner.result.done) break;
    const chunk = winner.result.value;

    // 이미지 chunk → 파일로 전송
    if (chunk.type === "image") {
        await flush();
        const ext = chunk.mediaType.split("/")[1] ?? "png";
        await ch.send({
            files: [{ attachment: chunk.data, name: `screenshot.${ext}` }],
        });
        next = iter.next();
        tick = delay();
        continue;
    }

    s.buffer += chunk.text;

    // 2000자 초과 → 현재 메시지 확정, 나머지를 새 메시지로
    if (s.msg && s.buffer.length > 2000) {
        await s.msg.edit(s.buffer.slice(0, 2000)).catch(() => {});
        s.buffer = s.buffer.slice(2000);
        s.msg = null;
    }

    next = iter.next();
}
```

주의: `flush()` 호출 후 이미지를 전송하여 기존 텍스트 버퍼가 먼저 전송되도록 한다.

- [ ] **Step 2: Verify type check**

Run: `cd /Users/me/Desktop/openwaifu && bun --filter '@lib/chat-platform' check`
Expected: Pass

- [ ] **Step 3: Commit**

```bash
git add libs/chat-platform/src/discord.ts
git commit -m "feat: send image chunks as file attachments in Discord"
```

---

### Task 5: Add Image Sending in Telegram

**Files:**
- Modify: `libs/chat-platform/src/telegram.ts:120-174`

- [ ] **Step 1: Add InputFile import**

In `libs/chat-platform/src/telegram.ts`, add `InputFile` to the grammy import:

```typescript
import { Bot, InputFile } from "grammy";
```

- [ ] **Step 2: Modify sendStream to handle image chunks**

In the `for await` loop (line 148), add image handling before the text processing:

Replace the try block content (lines 147-169) with:

```typescript
try {
    for await (const chunk of stream) {
        // 이미지 chunk → 사진으로 전송
        if (chunk.type === "image") {
            if (msgId) await sync();
            await bot.api.sendPhoto(
                chatId,
                new InputFile(chunk.data, "screenshot.png"),
            );
            continue;
        }

        buffer += chunk.text;

        if (!msgId) {
            const sent = await bot.api.sendMessage(chatId, buffer);
            msgId = sent.message_id;
            synced = buffer;
        }

        // 4096자 초과 → 현재 메시지 확정, 나머지는 새 메시지로
        if (buffer.length > 4096 && msgId) {
            await sync();
            await bot.api
                .editMessageText(chatId, msgId, buffer.slice(0, 4096))
                .catch(() => {});
            buffer = buffer.slice(4096);
            const sent = await bot.api.sendMessage(chatId, buffer);
            msgId = sent.message_id;
            synced = buffer;
        }
    }

    await sync();
} finally {
    clearInterval(editTimer);
}
```

- [ ] **Step 3: Verify type check**

Run: `cd /Users/me/Desktop/openwaifu && bun --filter '@lib/chat-platform' check`
Expected: Pass

- [ ] **Step 4: Commit**

```bash
git add libs/chat-platform/src/telegram.ts
git commit -m "feat: send image chunks as photos in Telegram"
```

---

### Task 6: Full Verification

- [ ] **Step 1: Workspace-wide type check**

Run: `cd /Users/me/Desktop/openwaifu && bun run check`
Expected: All packages pass (biome + tsc)

- [ ] **Step 2: Verify MCP discovery picks up browser server**

Manually verify by running:

```bash
cd /Users/me/Desktop/openwaifu && bun -e "
import { discoverMcpServers } from '@lib/mcp-discovery';
const servers = discoverMcpServers();
console.log('browser' in servers ? 'OK: browser server discovered' : 'FAIL: browser not found');
console.log(servers['browser']);
"
```

Expected:
```
OK: browser server discovered
{ command: "bun", args: ["run", "<path>/mcps/browser/src/index.ts"] }
```

- [ ] **Step 3: Final commit (if any remaining changes)**

```bash
git status
# If clean, skip. If changes, commit appropriately.
```
