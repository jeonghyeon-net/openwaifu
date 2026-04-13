import type { Api, Model } from "@mariozechner/pi-ai";
import { describe, expect, it, vi } from "vitest";

import { applyReasoningEffort, withReasoningEffort } from "../src/integrations/pi/reasoning-effort.js";

const createModel = (provider: string, reasoning = true): Model<Api> => ({
  id: "m",
  name: "model",
  api: "openai-responses",
  baseUrl: "https://example.com",
  provider,
  reasoning,
  input: ["text"],
  cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
  contextWindow: 1,
  maxTokens: 1,
});

describe("reasoning effort", () => {
  it("applies effort to responses payloads", () => {
    const payload = applyReasoningEffort(
      { include: ["x"], input: [], reasoning: { summary: "detailed" } },
      createModel("openai-codex"),
      "low",
    );
    const kept = applyReasoningEffort(
      { include: ["reasoning.encrypted_content"], input: [] },
      createModel("openai-codex"),
      "low",
    );
    expect(payload).toEqual({
      include: ["x", "reasoning.encrypted_content"],
      input: [],
      reasoning: { effort: "low", summary: "detailed" },
    });
    expect(kept).toEqual({
      include: ["reasoning.encrypted_content"],
      input: [],
      reasoning: { effort: "low", summary: "auto" },
    });
  });

  it("applies effort to completions payloads", () => {
    const payload = applyReasoningEffort({ messages: [] }, createModel("openai"), "high");
    expect(payload).toEqual({ messages: [], reasoning_effort: "high" });
  });

  it("skips missing effort, unsupported providers, and unknown payload shapes", () => {
    expect(applyReasoningEffort({ input: [] }, createModel("openai"), undefined)).toEqual({ input: [] });
    expect(applyReasoningEffort({ input: [] }, createModel("google"), "low")).toEqual({ input: [] });
    expect(applyReasoningEffort({ input: [] }, createModel("openai", false), "low")).toEqual({ input: [] });
    expect(applyReasoningEffort({ other: true }, createModel("openai"), "low")).toEqual({ other: true });
  });

  it("wraps existing payload hook and falls back to original payload", async () => {
    expect(withReasoningEffort(undefined, undefined)).toBeUndefined();
    const passthrough = vi.fn(async (payload: unknown) => payload);
    expect(withReasoningEffort(passthrough, undefined)).toBe(passthrough);

    const missingPayload = vi.fn(async () => undefined);
    const wrapped = withReasoningEffort(missingPayload, "low");
    await expect(wrapped?.({ input: [] }, createModel("openai-codex"))).resolves.toEqual({
      include: ["reasoning.encrypted_content"],
      input: [],
      reasoning: { effort: "low", summary: "auto" },
    });
    const nextPayload = vi.fn(async () => ({ input: ["x"] }));
    const replaced = withReasoningEffort(nextPayload, "low");
    await expect(replaced?.({ input: [] }, createModel("openai-codex"))).resolves.toEqual({
      include: ["reasoning.encrypted_content"],
      input: ["x"],
      reasoning: { effort: "low", summary: "auto" },
    });
    expect(missingPayload).toHaveBeenCalled();
    expect(nextPayload).toHaveBeenCalled();
  });
});
