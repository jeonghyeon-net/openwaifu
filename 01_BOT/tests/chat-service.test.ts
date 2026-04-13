import { describe, expect, it, vi } from "vitest";

import { createChatService } from "../src/features/chat/chat-service.js";

describe("createChatService", () => {
  it("forwards request fields into runtime prompt and stream", async () => {
    const prompt = vi.fn(async () => "reply");
    const stream = vi.fn(async function* () {
      yield { type: "text" as const, text: "chunk" };
    });
    const service = createChatService({ prompt, stream });
    const request = {
      prompt: "hello",
      scopeId: "channel:1:user:2",
      messageId: "m1",
      authorId: "2",
      channelId: "1",
      channelName: "개발",
      guildId: "g",
      guildName: "jeonghyeon.net",
      isDirectMessage: false,
      attachments: [{ name: "notes.txt", url: "u", size: 1 }],
    };
    const result = await service.reply(request);
    const chunks: string[] = [];
    for await (const chunk of service.stream(request)) {
      chunks.push(chunk.text);
    }

    expect(result).toBe("reply");
    expect(chunks).toEqual(["chunk"]);
    expect(prompt).toHaveBeenCalledWith(
      "channel:1:user:2",
      "hello",
      { authorId: "2", channelId: "1", channelName: "개발", guildId: "g", guildName: "jeonghyeon.net", isDirectMessage: false },
      { messageId: "m1", attachments: [{ name: "notes.txt", url: "u", size: 1 }] },
    );
    expect(stream).toHaveBeenCalledWith(
      "channel:1:user:2",
      "hello",
      { authorId: "2", channelId: "1", channelName: "개발", guildId: "g", guildName: "jeonghyeon.net", isDirectMessage: false },
      { messageId: "m1", attachments: [{ name: "notes.txt", url: "u", size: 1 }] },
    );
  });
});
