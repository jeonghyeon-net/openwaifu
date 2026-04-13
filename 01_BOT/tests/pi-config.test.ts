import { describe, expect, it } from "vitest";

import {
  resolvePiModel,
  resolvePiProvider,
  resolvePiReasoningEffort,
  resolvePiThinkingLevel,
} from "../src/config/pi-config.js";

describe("pi config", () => {
  it("resolves provider and model defaults", () => {
    expect(resolvePiProvider({})).toBe("openai-codex");
    expect(resolvePiProvider({ OPENAI_API_KEY: "sk-test" })).toBe("openai");
    expect(resolvePiProvider({ PI_PROVIDER: "openai-codex" })).toBe("openai-codex");
    expect(resolvePiModel({}, "openai-codex")).toBe("gpt-5.4");
    expect(resolvePiModel({ PI_MODEL: "gpt-5.4-mini" }, "openai")).toBe("gpt-5.4-mini");
  });

  it("resolves thinking and effort", () => {
    expect(resolvePiThinkingLevel({ PI_THINKING_LEVEL: "high" })).toBe("high");
    expect(resolvePiReasoningEffort({ PI_REASONING_EFFORT: "low" })).toBe("low");
    expect(resolvePiThinkingLevel({})).toBeUndefined();
    expect(resolvePiReasoningEffort({})).toBeUndefined();
  });

  it("throws on missing custom model", () => {
    expect(() => resolvePiModel({}, "custom")).toThrow("Missing PI_MODEL for provider custom");
  });

  it("throws on invalid thinking and effort", () => {
    expect(() => resolvePiThinkingLevel({ PI_THINKING_LEVEL: "bad" })).toThrow("Invalid PI_THINKING_LEVEL: bad");
    expect(() => resolvePiReasoningEffort({ PI_REASONING_EFFORT: "bad" })).toThrow("Invalid PI_REASONING_EFFORT: bad");
  });
});
