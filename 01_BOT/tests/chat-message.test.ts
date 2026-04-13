import { describe, expect, it } from "vitest";

import { buildChatRequest } from "../src/features/chat/chat-message.js";

describe("buildChatRequest", () => {
  it("ignores bot messages", () => {
    expect(buildChatRequest({ authorId: "u", channelId: "c", content: "hello", isBot: true, isDirectMessage: false })).toBeNull();
  });

  it("ignores empty messages", () => {
    expect(buildChatRequest({ authorId: "u", channelId: "c", content: "   ", isBot: false, isDirectMessage: false })).toBeNull();
  });

  it("uses per-user scope for guild messages", () => {
    expect(buildChatRequest({ authorId: "u", channelId: "c", content: "hello", guildId: "g", isBot: false, isDirectMessage: false })).toEqual({
      prompt: "hello",
      scopeId: "channel:c:user:u",
      authorId: "u",
      channelId: "c",
      guildId: "g",
      isDirectMessage: false,
    });
  });

  it("uses dm scope for direct messages", () => {
    expect(buildChatRequest({ authorId: "u", channelId: "dm", content: "hello", isBot: false, isDirectMessage: true })).toEqual({
      prompt: "hello",
      scopeId: "dm:u",
      authorId: "u",
      channelId: "dm",
      guildId: undefined,
      isDirectMessage: true,
    });
  });
});
