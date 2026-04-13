import { describe, expect, it, vi } from "vitest";

import { createChatService } from "../src/features/chat/chat-service.js";

describe("createChatService", () => {
  it("forwards request fields into runtime prompt", async () => {
    const prompt = vi.fn(async () => "reply");
    const service = createChatService({ prompt });
    const result = await service.reply({
      prompt: "hello",
      scopeId: "channel:1:user:2",
      authorId: "2",
      channelId: "1",
      guildId: "g",
      isDirectMessage: false,
    });
    expect(result).toBe("reply");
    expect(prompt).toHaveBeenCalledWith("channel:1:user:2", "hello", {
      authorId: "2",
      channelId: "1",
      guildId: "g",
      isDirectMessage: false,
    });
  });
});
