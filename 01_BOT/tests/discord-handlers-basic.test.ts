import { describe, expect, it, vi } from "vitest";

import { createHandlerEnv, attachments, discordMessage, textStream } from "./discord-handler-test-utils.js";

describe("discord handlers basic", () => {
  it("ignores bot messages, streams replies, forwards attachments, and reports errors", async () => {
    const setPresence = vi.fn();
    const client = { on: vi.fn(), user: { setPresence } };
    const chatService = { stream: vi.fn(() => textStream("ok")), reply: vi.fn(async () => "unused") };
    const { run } = createHandlerEnv(chatService, client);

    await run(discordMessage({ id: "bot", author: { bot: true, id: "u" }, content: "x" }));
    expect(chatService.stream).not.toHaveBeenCalled();

    const message = discordMessage({
      id: "m1",
      attachments: attachments({ name: "photo.png", url: "https://x/photo.png", contentType: "image/png", size: 3 }),
    });
    await run(message);
    expect(chatService.stream).toHaveBeenCalledWith(expect.objectContaining({
      messageId: "m1",
      attachments: [{ name: "photo.png", url: "https://x/photo.png", contentType: "image/png", size: 3 }],
    }));
    expect((message.channel as { sendTyping: ReturnType<typeof vi.fn> }).sendTyping).toHaveBeenCalled();
    expect(message.reply).toHaveBeenCalledWith("ok");
    expect(setPresence).toHaveBeenNthCalledWith(1, { status: "dnd" });
    expect(setPresence).toHaveBeenNthCalledWith(2, { status: "online" });

    const dm = discordMessage({
      id: "m2",
      channel: { isDMBased: () => true, sendTyping: vi.fn(async () => undefined) },
      channelId: "dm",
      content: "",
      guildId: null,
      attachments: attachments({ name: null, url: "https://x/notes.txt", contentType: null, size: 5 }),
    });
    chatService.stream.mockImplementationOnce(async function* () { throw new Error("boom"); });
    await run(dm);
    expect(chatService.stream).toHaveBeenCalledWith(expect.objectContaining({ prompt: "User sent attachment files. Analyze them.", scopeId: "dm:u" }));
    expect(dm.reply).toHaveBeenLastCalledWith("에러: boom");

    chatService.stream.mockImplementationOnce(async function* () { throw "oops"; });
    await run(dm);
    expect(dm.reply).toHaveBeenLastCalledWith("에러: oops");
  });
});
