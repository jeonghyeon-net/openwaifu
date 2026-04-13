import { describe, expect, it } from "vitest";

import { createRuntime, createdSessions, discordClient, find, open, prepareChatPrompt } from "./pi-runtime-test-helpers.js";

describe("PiRuntime core", () => {
  it("streams prompt text, reuses sessions, and prepares attachment-aware prompts", async () => {
    const runtime = await createRuntime();
    await expect(runtime.prompt("scope:a", "hello", { authorId: "u", channelId: "c", guildId: "g", isDirectMessage: false }, { messageId: "m1", attachments: [{ name: "notes.txt", url: "u", size: 1 }] })).resolves.toBe("hello");
    await expect(runtime.prompt("scope:a", "again", { authorId: "u", channelId: "c", guildId: "g", isDirectMessage: false })).resolves.toBe("again");
    expect(prepareChatPrompt).toHaveBeenCalledWith({ repoRoot: "/repo", scopeId: "scope:a", messageId: "m1", prompt: "hello", attachments: [{ name: "notes.txt", url: "u", size: 1 }] });
    expect(createdSessions[0]?.prompt).toHaveBeenCalledWith("hello", undefined);
    expect(createdSessions).toHaveLength(1);
    expect(open).toHaveBeenCalledWith(expect.stringContaining("scope_a.jsonl"), expect.any(String), "/repo");
  });

  it("passes prompt images, creates fresh session per scope, and fails on missing model", async () => {
    prepareChatPrompt.mockResolvedValueOnce({ prompt: "with image", images: [{ type: "image", data: "abc", mimeType: "image/png" }] });
    const runtime = await createRuntime();
    const chunks: string[] = [];
    for await (const chunk of runtime.stream("scope:a", "one", { authorId: "u", channelId: "a", guildId: "g", isDirectMessage: false }, { messageId: "m2", attachments: [] })) chunks.push(chunk.text);
    await runtime.prompt("scope:b", "two", { authorId: "u", channelId: "b", guildId: "g", isDirectMessage: false });
    expect(chunks).toEqual(["with image"]);
    expect(createdSessions[0]?.prompt).toHaveBeenCalledWith("with image", { images: [{ type: "image", data: "abc", mimeType: "image/png" }] });
    expect(createdSessions).toHaveLength(2);
    find.mockReturnValueOnce(undefined);
    const { PiRuntime } = await import("../src/integrations/pi/pi-runtime.js");
    await expect(PiRuntime.create({ repoRoot: "/repo", sessionsRoot: "/tmp", extensionsRoot: "/ext", skillsRoot: "/skills", modelId: "gpt-5.4", thinkingLevel: "high", discordClient })).rejects.toThrow("Model not found");
  });

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
      {
        type: "message",
        message: {
          role: "assistant",
          content: [{ type: "toolCall", id: "call-1", name: "read", arguments: { path: "README" } }],
          usage: {
            input: 10,
            output: 4,
            cacheRead: 1,
            cacheWrite: 2,
            cost: { total: 0.33 },
          },
        },
      },
      { type: "message", message: { role: "toolResult" } },
      {
        type: "message",
        message: {
          role: "assistant",
          content: [{ type: "text", text: "done" }],
          usage: {
            input: 5,
            output: 3,
            cacheRead: 0,
            cacheWrite: 0,
            cost: { total: 0.11 },
          },
        },
      },
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
      tokens: {
        input: 15,
        output: 7,
        cacheRead: 1,
        cacheWrite: 2,
        total: 25,
      },
    });
    expect(stats?.cost).toBeCloseTo(0.44, 10);

    await runtime.resetScope("scope:a");
    expect(session.abort).toHaveBeenCalledTimes(1);
    expect(session.dispose).toHaveBeenCalledTimes(1);

    await runtime.prompt("scope:a", "again", { authorId: "u", channelId: "c", guildId: "g", isDirectMessage: false });
    expect(createdSessions).toHaveLength(2);
  });

  it("runs scheduled prompts in fresh clean sessions", async () => {
    const runtime = await createRuntime();
    await expect(runtime.runScheduledPrompt("scope:a", "task-1", "do thing", { authorId: "u", channelId: "c", guildId: "g", isDirectMessage: false })).resolves.toBe("reply");
    await expect(runtime.runScheduledPrompt("scope:a", "task-1", "do thing again", { authorId: "u", channelId: "c", guildId: "g", isDirectMessage: false })).resolves.toBe("reply");
    expect(createdSessions).toHaveLength(2);
    expect(createdSessions[0]?.prompt).toHaveBeenCalledWith("do thing");
    expect(createdSessions[1]?.prompt).toHaveBeenCalledWith("do thing again");
    expect(open).toHaveBeenNthCalledWith(1, expect.stringContaining("scheduled__scope_a__task-1__"), expect.any(String), "/repo");
    expect(open).toHaveBeenNthCalledWith(2, expect.stringContaining("scheduled__scope_a__task-1__"), expect.any(String), "/repo");
  });
});
