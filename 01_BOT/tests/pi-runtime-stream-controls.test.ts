import { describe, expect, it } from "vitest";

import type { MockSession, SessionEvent } from "./pi-runtime-test-helpers.js";
import { createRuntime, createdSessions, setPromptImpl } from "./pi-runtime-test-helpers.js";

const emit = (session: MockSession, event: SessionEvent) => (session as MockSession & { emit(event: SessionEvent): void }).emit(event);

describe("PiRuntime stream controls", () => {
  it("waits for delayed chunks and aborts if consumer stops early", async () => {
    let resolveStream: () => void = () => undefined;
    const streamGate = new Promise<void>((resolve) => { resolveStream = resolve; });
    setPromptImpl(async (session, text) => {
      await streamGate;
      emit(session, { type: "message_update", message: { role: "assistant" }, assistantMessageEvent: { type: "text_delta", delta: text } });
      if (text === "stop") await new Promise<void>(() => undefined);
    });
    const runtime = await createRuntime();
    const delayedIterator = runtime.stream("scope:a", "later", { authorId: "u", channelId: "c", guildId: "g", isDirectMessage: false })[Symbol.asyncIterator]();
    const delayedNext = delayedIterator.next();
    resolveStream();
    await expect(delayedNext).resolves.toEqual({ done: false, value: { type: "text", text: "later" } });

    let resolveStop: () => void = () => undefined;
    const stopGate = new Promise<void>((resolve) => { resolveStop = resolve; });
    setPromptImpl(async (session, text) => {
      emit(session, { type: "message_update", message: { role: "assistant" }, assistantMessageEvent: { type: "text_delta", delta: text } });
      if (text === "stop") await stopGate;
    });
    const stopIterator = runtime.stream("scope:b", "stop", { authorId: "u", channelId: "c", guildId: "g", isDirectMessage: false })[Symbol.asyncIterator]();
    await expect(stopIterator.next()).resolves.toEqual({ done: false, value: { type: "text", text: "stop" } });
    createdSessions[1]?.abort.mockImplementationOnce(async () => resolveStop());
    await stopIterator.return?.();
    expect(createdSessions[1]?.abort).toHaveBeenCalledTimes(1);
  });

  it("interrupts in-flight scope prompt before starting newer prompt", async () => {
    let resolveFirst: () => void = () => undefined;
    const releaseFirst = new Promise<void>((resolve) => { resolveFirst = resolve; });
    setPromptImpl(async (session, text) => {
      emit(session, { type: "message_update", message: { role: "assistant" }, assistantMessageEvent: { type: "text_delta", delta: text } });
      if (text === "first") await releaseFirst;
    });
    const runtime = await createRuntime();
    const firstIterator = runtime.stream("scope:a", "first", { authorId: "u", channelId: "c", guildId: "g", isDirectMessage: false })[Symbol.asyncIterator]();
    await expect(firstIterator.next()).resolves.toEqual({ done: false, value: { type: "text", text: "first" } });
    createdSessions[0]?.abort.mockImplementationOnce(async () => resolveFirst());
    await expect(runtime.prompt("scope:a", "second", { authorId: "u", channelId: "c", guildId: "g", isDirectMessage: false })).resolves.toBe("second");
    expect(createdSessions[0]?.abort).toHaveBeenCalledTimes(1);
    await expect(firstIterator.next()).resolves.toEqual({ done: true, value: undefined });
  });
});
