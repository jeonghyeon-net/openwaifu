import { describe, expect, it, vi } from "vitest";

import { createHandlerEnv, discordMessage } from "./discord-handler-test-utils.js";

describe("discord handlers typing", () => {
  it("keeps typing, tolerates missing client user, and edits streamed reply", async () => {
    vi.useFakeTimers();
    try {
      let releaseStart: () => void = () => undefined;
      let releaseEnd: () => void = () => undefined;
      const start = new Promise<void>((resolve) => { releaseStart = resolve; });
      const end = new Promise<void>((resolve) => { releaseEnd = resolve; });
      const edit = vi.fn(async () => undefined);
      const chatService = {
        stream: vi.fn(async function* () {
          await start;
          yield { type: "text" as const, text: "hi" };
          await end;
          yield { type: "text" as const, text: " there" };
        }),
        reply: vi.fn(async () => "unused"),
      };
      const client = { on: vi.fn() };
      const { run } = createHandlerEnv(chatService, client);
      const message = discordMessage({ id: "m3", reply: vi.fn(async () => ({ edit })) });

      const pending = run(message);
      await vi.advanceTimersByTimeAsync(500);
      await vi.advanceTimersByTimeAsync(5_000);
      releaseStart();
      await vi.advanceTimersByTimeAsync(500);
      releaseEnd();
      await pending;

      expect((message.channel as { sendTyping: ReturnType<typeof vi.fn> }).sendTyping).toHaveBeenCalledTimes(2);
      expect(message.reply).toHaveBeenCalledWith("hi");
      expect(edit).toHaveBeenCalledWith("hi there");
    } finally {
      vi.useRealTimers();
    }
  });
});
