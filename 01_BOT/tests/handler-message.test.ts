import { describe, expect, it, vi } from "vitest";

import { toChatMessage, type IncomingDiscordMessage } from "../src/integrations/discord/handler-message.js";
import { attachments } from "./discord-handler-test-utils.js";

describe("toChatMessage", () => {
  it("keeps guild and channel names when available", () => {
    expect(
      toChatMessage({
        id: "m1",
        author: { bot: false, id: "u" } as IncomingDiscordMessage["author"],
        channel: { name: "개발", isDMBased: () => false, sendTyping: vi.fn(async () => undefined) },
        channelId: "c",
        content: "hello",
        guild: { name: "jeonghyeon.net" } as IncomingDiscordMessage["guild"],
        guildId: "g",
        reply: vi.fn(async () => undefined),
        attachments: attachments(),
      }),
    ).toEqual({
      messageId: "m1",
      authorId: "u",
      channelId: "c",
      channelName: "개발",
      content: "hello",
      guildId: "g",
      guildName: "jeonghyeon.net",
      isBot: false,
      isDirectMessage: false,
      attachments: [],
    });
  });

  it("falls back to direct-message label for dms", () => {
    expect(
      toChatMessage({
        id: "m2",
        author: { bot: false, id: "u" } as IncomingDiscordMessage["author"],
        channel: { isDMBased: () => true, sendTyping: vi.fn(async () => undefined) },
        channelId: "dm",
        content: "hello",
        guildId: null,
        reply: vi.fn(async () => undefined),
        attachments: attachments({ name: null, url: "u", contentType: null, size: 1 }),
      }),
    ).toEqual({
      messageId: "m2",
      authorId: "u",
      channelId: "dm",
      channelName: "direct-message",
      content: "hello",
      guildId: undefined,
      guildName: undefined,
      isBot: false,
      isDirectMessage: true,
      attachments: [{ name: "attachment", url: "u", contentType: undefined, size: 1 }],
    });
  });
});
