import { describe, expect, it } from "vitest";

import { buildChatRequest } from "../src/features/chat/chat-message.js";

describe("buildChatRequest", () => {
  it("ignores bot messages", () => {
    expect(buildChatRequest({ messageId: "m", authorId: "u", channelId: "c", content: "hello", isBot: true, isDirectMessage: false, attachments: [] })).toBeNull();
  });

  it("ignores empty messages without attachments", () => {
    expect(buildChatRequest({ messageId: "m", authorId: "u", channelId: "c", content: "   ", isBot: false, isDirectMessage: false, attachments: [] })).toBeNull();
  });

  it("uses per-user scope for guild messages", () => {
    expect(buildChatRequest({ messageId: "m1", authorId: "u", channelId: "c", channelName: "개발", content: "hello", guildId: "g", guildName: "jeonghyeon.net", isBot: false, isDirectMessage: false, attachments: [] })).toEqual({
      prompt: "hello",
      scopeId: "channel:c:user:u",
      messageId: "m1",
      authorId: "u",
      channelId: "c",
      channelName: "개발",
      guildId: "g",
      guildName: "jeonghyeon.net",
      isDirectMessage: false,
      attachments: [],
    });
  });

  it("uses dm scope and attachment-only fallback prompt", () => {
    expect(buildChatRequest({ messageId: "m2", authorId: "u", channelId: "dm", content: "hello", isBot: false, isDirectMessage: true, attachments: [] })).toEqual({
      prompt: "hello",
      scopeId: "dm:u",
      messageId: "m2",
      authorId: "u",
      channelId: "dm",
      channelName: undefined,
      guildId: undefined,
      guildName: undefined,
      isDirectMessage: true,
      attachments: [],
    });
    expect(buildChatRequest({ messageId: "m3", authorId: "u", channelId: "c", content: "   ", isBot: false, isDirectMessage: false, attachments: [{ name: "photo.png", url: "u", size: 1, contentType: "image/png" }] })).toEqual(expect.objectContaining({ prompt: "User sent attachment files. Analyze them." }));
  });
});
