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
    await expect(PiRuntime.create({ repoRoot: "/repo", sessionsRoot: "/tmp", extensionsRoot: "/ext", skillsRoot: "/skills", provider: "openai-codex", modelId: "gpt-5.4", thinkingLevel: "high", reasoningEffort: "low", discordClient })).rejects.toThrow("Model not found");
  });
});
