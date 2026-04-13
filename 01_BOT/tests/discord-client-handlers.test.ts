import { describe, expect, it, vi } from "vitest";
import { Events, GatewayIntentBits, Partials, type Client, type Message } from "discord.js";

import { createDiscordClient } from "../src/integrations/discord/client.js";
import { registerDiscordHandlers } from "../src/integrations/discord/handlers.js";

describe("discord integration", () => {
  it("creates client with required intents and partials", () => {
    const client = createDiscordClient();
    expect(client.options.intents.has(GatewayIntentBits.GuildMembers)).toBe(true);
    expect(client.options.intents.has(GatewayIntentBits.MessageContent)).toBe(true);
    expect(client.options.partials).toContain(Partials.Channel);
    client.destroy();
  });

  it("replies on success and error, ignores invalid messages", async () => {
    const handlers = new Map<string, (message: Message<boolean>) => Promise<void>>();
    const client = Object.assign({} as Client, {
      on: vi.fn((event, handler) => handlers.set(event, handler)),
    });
    const chatService = { reply: vi.fn(async () => "ok") };
    registerDiscordHandlers({ client, chatService });
    const run = handlers.get(Events.MessageCreate);
    if (!run) throw new Error("handler missing");

    const ignored = Object.assign({} as Message<boolean>, {
      author: { bot: true, id: "u" },
      channel: { isDMBased: () => false },
      channelId: "c",
      content: "x",
      reply: vi.fn(),
      guildId: "g",
    });
    await run(ignored);
    expect(ignored.reply).not.toHaveBeenCalled();

    const message = Object.assign({} as Message<boolean>, {
      author: { bot: false, id: "u" },
      channel: { isDMBased: () => false },
      channelId: "c",
      content: "hello",
      reply: vi.fn(async () => undefined),
      guildId: "g",
    });
    await run(message);
    expect(chatService.reply).toHaveBeenCalled();
    expect(message.reply).toHaveBeenCalledWith("ok");

    const dm = Object.assign({} as Message<boolean>, {
      author: { bot: false, id: "u" },
      channel: { isDMBased: () => true },
      channelId: "dm",
      content: "hello",
      reply: vi.fn(async () => undefined),
      guildId: null,
    });
    chatService.reply.mockRejectedValueOnce(new Error("boom"));
    await run(dm);
    expect(chatService.reply).toHaveBeenCalledWith({ prompt: "hello", scopeId: "dm:u", authorId: "u", channelId: "dm", guildId: undefined, isDirectMessage: true });
    expect(dm.reply).toHaveBeenLastCalledWith("에러: boom");

    chatService.reply.mockRejectedValueOnce("oops");
    await run(dm);
    expect(dm.reply).toHaveBeenLastCalledWith("에러: oops");
  });
});
