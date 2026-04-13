import { describe, expect, it, vi } from "vitest";
import { Events, GatewayIntentBits, Partials, type Client, type Message } from "discord.js";

import { createDiscordClient } from "../src/integrations/discord/client.js";
import { registerDiscordHandlers } from "../src/integrations/discord/handlers.js";

const attachments = (...items: Array<{ name: string | null; url: string; contentType: string | null; size: number }>) => ({
  values: () => items.values(),
});

describe("discord integration", () => {
  it("creates client with required intents and partials", () => {
    const client = createDiscordClient();
    expect(client.options.intents.has(GatewayIntentBits.GuildMembers)).toBe(true);
    expect(client.options.intents.has(GatewayIntentBits.MessageContent)).toBe(true);
    expect(client.options.partials).toContain(Partials.Channel);
    client.destroy();
  });

  it("replies on success and error, ignores invalid messages, forwards attachments", async () => {
    const handlers = new Map<string, (message: Message<boolean>) => Promise<void>>();
    const client = Object.assign({} as Client, { on: vi.fn((event, handler) => handlers.set(event, handler)) });
    const chatService = { reply: vi.fn(async () => "ok") };
    registerDiscordHandlers({ client, chatService });
    const run = handlers.get(Events.MessageCreate);
    if (!run) throw new Error("handler missing");

    await run(Object.assign({} as Message<boolean>, { id: "i", author: { bot: true, id: "u" }, channel: { isDMBased: () => false }, channelId: "c", content: "x", reply: vi.fn(), guildId: "g", attachments: attachments() }));
    expect(chatService.reply).not.toHaveBeenCalled();

    const message = Object.assign({} as Message<boolean>, { id: "m1", author: { bot: false, id: "u" }, channel: { isDMBased: () => false }, channelId: "c", content: "hello", reply: vi.fn(async () => undefined), guildId: "g", attachments: attachments({ name: "photo.png", url: "https://x/photo.png", contentType: "image/png", size: 3 }) });
    await run(message);
    expect(chatService.reply).toHaveBeenCalledWith(expect.objectContaining({ messageId: "m1", attachments: [{ name: "photo.png", url: "https://x/photo.png", contentType: "image/png", size: 3 }] }));
    expect(message.reply).toHaveBeenCalledWith("ok");

    const dm = Object.assign({} as Message<boolean>, { id: "m2", author: { bot: false, id: "u" }, channel: { isDMBased: () => true }, channelId: "dm", content: "", reply: vi.fn(async () => undefined), guildId: null, attachments: attachments({ name: null, url: "https://x/notes.txt", contentType: null, size: 5 }) });
    chatService.reply.mockRejectedValueOnce(new Error("boom"));
    await run(dm);
    expect(chatService.reply).toHaveBeenCalledWith(expect.objectContaining({ prompt: "User sent attachment files. Analyze them.", scopeId: "dm:u" }));
    expect(dm.reply).toHaveBeenLastCalledWith("에러: boom");

    chatService.reply.mockRejectedValueOnce("oops");
    await run(dm);
    expect(dm.reply).toHaveBeenLastCalledWith("에러: oops");
  });
});
