import { describe, expect, it, vi } from "vitest";

import { createHandlerEnv, discordMessage, textStream } from "./discord-handler-test-utils.js";

describe("discord handlers overflow", () => {
  it("handles reply calls that do not return editable messages", async () => {
    const chatService = { stream: vi.fn(() => textStream("ok")), reply: vi.fn(async () => "unused") };
    const client = { on: vi.fn(), user: { setPresence: vi.fn() } };
    const { run } = createHandlerEnv(chatService, client);
    const message = discordMessage({ id: "m35", reply: vi.fn(async () => undefined) });
    await run(message);
    expect(message.reply).toHaveBeenCalledWith("ok");
  });

  it("splits overflow into multiple replies", async () => {
    vi.useFakeTimers();
    try {
      let releaseTail: () => void = () => undefined;
      const tail = new Promise<void>((resolve) => { releaseTail = resolve; });
      const firstEdit = vi.fn(async () => undefined);
      const secondEdit = vi.fn(async () => undefined);
      const chatService = {
        stream: vi.fn(async function* () {
          yield { type: "text" as const, text: "a".repeat(1900) };
          await tail;
          yield { type: "text" as const, text: "b" };
        }),
        reply: vi.fn(async () => "unused"),
      };
      const client = { on: vi.fn(), user: { setPresence: vi.fn() } };
      const { run } = createHandlerEnv(chatService, client);
      const replies = [{ edit: firstEdit }, { edit: secondEdit }];
      const message = discordMessage({ id: "m4", reply: vi.fn(async () => replies.shift()) });

      const pending = run(message);
      await vi.advanceTimersByTimeAsync(500);
      releaseTail();
      await pending;

      expect(message.reply).toHaveBeenNthCalledWith(1, "a".repeat(1900));
      expect(firstEdit).toHaveBeenCalledWith("a".repeat(1900));
      expect(message.reply).toHaveBeenNthCalledWith(2, "b");
      expect(secondEdit).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });
});
