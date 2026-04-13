import { describe, expect, it } from "vitest";
import type { AgentSession } from "@mariozechner/pi-coding-agent";

import { limitText } from "../src/integrations/pi/format-text";
import { lastAssistantText } from "../src/integrations/pi/last-assistant-text";
import { ScopedQueue } from "../src/integrations/pi/scoped-queue";

describe("pi utils", () => {
  it("limits long text and preserves short text", () => {
    expect(limitText("hi")).toBe("hi");
    expect(limitText("x".repeat(1901)).endsWith("(truncated)")).toBe(true);
  });

  it("extracts latest assistant text and falls back when absent", () => {
    const empty = { messages: [] } as AgentSession;
    expect(lastAssistantText(empty)).toBe("응답 없음");
    const blank = { messages: [{ role: "assistant", content: [{ type: "text", text: "   " }, { type: "toolCall", id: "1", name: "x", arguments: {} }] }] } as AgentSession;
    expect(lastAssistantText(blank)).toBe("응답 없음");
    const session = {
      messages: [{ role: "assistant", content: [{ type: "text", text: "hello" }, { type: "text", text: "world" }] }],
    } as AgentSession;
    expect(lastAssistantText(session)).toBe("hello\nworld");
  });

  it("serializes work per scope but allows other scopes", async () => {
    const queue = new ScopedQueue();
    const events: string[] = [];
    const first = queue.run("a", async () => {
      events.push("a:start");
      await Promise.resolve();
      events.push("a:end");
    });
    const second = queue.run("a", async () => events.push("a:next"));
    const third = queue.run("b", async () => events.push("b:run"));
    await Promise.all([first, second, third]);
    expect(events.indexOf("a:end")).toBeLessThan(events.indexOf("a:next"));
    expect(events).toContain("b:run");
  });
});
