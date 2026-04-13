import { describe, expect, it } from "vitest";

import type { MockSession, SessionEvent } from "./pi-runtime-test-helpers.js";
import { createRuntime, lastAssistantText, setPromptImpl } from "./pi-runtime-test-helpers.js";

const emit = (session: MockSession, event: SessionEvent) => (session as MockSession & { emit(event: SessionEvent): void }).emit(event);

describe("PiRuntime fallback", () => {
  it("falls back to last assistant text when no text delta arrives", async () => {
    lastAssistantText.mockReturnValueOnce("fallback");
    setPromptImpl(async (session) => {
      emit(session, { type: "message_update", message: { role: "user" }, assistantMessageEvent: { type: "text_delta", delta: "ignore" } });
      emit(session, { type: "message_update", message: { role: "assistant" }, assistantMessageEvent: { type: "thinking_delta", delta: "ignore" } });
    });
    const runtime = await createRuntime();
    await expect(runtime.prompt("scope:a", "hello", { authorId: "u", channelId: "c", guildId: "g", isDirectMessage: false })).resolves.toBe("fallback");
  });

  it("returns no-response text and surfaces prompt failures", async () => {
    lastAssistantText.mockReturnValueOnce("응답 없음");
    setPromptImpl(async () => undefined);
    const runtime = await createRuntime();
    await expect(runtime.prompt("scope:a", "hello", { authorId: "u", channelId: "c", guildId: "g", isDirectMessage: false })).resolves.toBe("응답 없음");
    setPromptImpl(async () => { throw new Error("boom"); });
    await expect(runtime.prompt("scope:b", "fail", { authorId: "u", channelId: "c", guildId: "g", isDirectMessage: false })).rejects.toThrow("boom");
  });
});
