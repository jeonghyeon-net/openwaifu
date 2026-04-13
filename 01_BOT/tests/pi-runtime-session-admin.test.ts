import { describe, expect, it } from "vitest";

import { createRuntime, createdSessions } from "./pi-runtime-test-helpers.js";

describe("PiRuntime session admin", () => {
  it("reports cached scope stats and resets cached sessions", async () => {
    const runtime = await createRuntime();
    expect(runtime.getScopeStats("scope:missing")).toBeUndefined();
    await runtime.prompt("scope:a", "hello", { authorId: "u", channelId: "c", guildId: "g", isDirectMessage: false });
    const session = createdSessions[0];
    if (!session) throw new Error("session missing");
    session.sessionManager.getSessionFile.mockReturnValue("/tmp/scope_a.jsonl");
    session.sessionManager.getSessionId.mockReturnValue("session-a");
    session.sessionManager.getEntries.mockReturnValue([
      { type: "message", message: { role: "user" } },
      { type: "message", message: { role: "assistant", content: [{ type: "toolCall", id: "call-1", name: "read", arguments: { path: "README" } }], usage: { input: 10, output: 4, cacheRead: 1, cacheWrite: 2, cost: { total: 0.33 } } } },
      { type: "message", message: { role: "toolResult" } },
      { type: "message", message: { role: "assistant", content: [{ type: "text", text: "done" }], usage: { input: 5, output: 3, cacheRead: 0, cacheWrite: 0, cost: { total: 0.11 } } } },
    ]);

    const stats = runtime.getScopeStats("scope:a");
    expect(stats).toMatchObject({
      sessionFile: "/tmp/scope_a.jsonl",
      sessionId: "session-a",
      userMessages: 1,
      assistantMessages: 2,
      toolCalls: 1,
      toolResults: 1,
      totalMessages: 4,
      tokens: { input: 15, output: 7, cacheRead: 1, cacheWrite: 2, total: 25 },
    });
    expect(stats?.cost).toBeCloseTo(0.44, 10);

    await runtime.resetScope("scope:a");
    expect(session.abort).toHaveBeenCalledTimes(1);
    expect(session.dispose).toHaveBeenCalledTimes(1);

    await runtime.prompt("scope:a", "again", { authorId: "u", channelId: "c", guildId: "g", isDirectMessage: false });
    expect(createdSessions).toHaveLength(2);
  });
});
