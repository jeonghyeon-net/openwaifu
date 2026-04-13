import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { SessionManager } from "@mariozechner/pi-coding-agent";
import { describe, expect, it } from "vitest";

import { readScopeSessionStats } from "../src/integrations/pi/session-admin.js";
import { sessionFileForScope } from "../src/integrations/pi/session-path.js";

describe("session stats", () => {
  it("returns undefined when scope session file is missing", () => {
    const repoRoot = mkdtempSync(join(tmpdir(), "openwaifu-repo-"));
    const sessionsRoot = mkdtempSync(join(tmpdir(), "openwaifu-sessions-"));
    expect(readScopeSessionStats(repoRoot, sessionsRoot, "channel:c:user:u")).toBeUndefined();
  });

  it("reads cumulative scope stats from persisted session entries", () => {
    const repoRoot = mkdtempSync(join(tmpdir(), "openwaifu-repo-"));
    const sessionsRoot = mkdtempSync(join(tmpdir(), "openwaifu-sessions-"));
    const scopeId = "channel:c:user:u";
    const sessionFile = sessionFileForScope(sessionsRoot, scopeId);
    const sessionManager = SessionManager.open(sessionFile, sessionsRoot, repoRoot);

    sessionManager.appendMessage({ role: "user", content: "hello", timestamp: Date.now() });
    sessionManager.appendMessage({
      role: "assistant",
      content: [{ type: "text", text: "hi" }, { type: "toolCall", id: "call-1", name: "read", arguments: { path: "README" } }],
      api: "openai-responses",
      provider: "openai",
      model: "gpt-5.4",
      usage: { input: 10, output: 4, cacheRead: 1, cacheWrite: 2, totalTokens: 17, cost: { input: 0.1, output: 0.2, cacheRead: 0.01, cacheWrite: 0.02, total: 0.33 } },
      stopReason: "toolUse",
      timestamp: Date.now(),
    });
    sessionManager.appendMessage({ role: "toolResult", toolCallId: "call-1", toolName: "read", content: [{ type: "text", text: "ok" }], isError: false, timestamp: Date.now() });
    sessionManager.appendMessage({
      role: "assistant",
      content: [{ type: "text", text: "done" }],
      api: "openai-responses",
      provider: "openai",
      model: "gpt-5.4",
      usage: { input: 5, output: 3, cacheRead: 0, cacheWrite: 0, totalTokens: 8, cost: { input: 0.05, output: 0.06, cacheRead: 0, cacheWrite: 0, total: 0.11 } },
      stopReason: "stop",
      timestamp: Date.now(),
    });

    const stats = readScopeSessionStats(repoRoot, sessionsRoot, scopeId);
    expect(stats).toMatchObject({
      sessionFile,
      sessionId: sessionManager.getSessionId(),
      userMessages: 1,
      assistantMessages: 2,
      toolCalls: 1,
      toolResults: 1,
      totalMessages: 4,
      tokens: { input: 15, output: 7, cacheRead: 1, cacheWrite: 2, total: 25 },
    });
    expect(stats?.cost).toBeCloseTo(0.44, 10);
  });
});
