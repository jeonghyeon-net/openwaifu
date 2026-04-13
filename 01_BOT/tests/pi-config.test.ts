import { describe, expect, it } from "vitest";

import {
  fixedPiProvider,
  resolvePiModel,
  resolvePiThinkingLevel,
} from "../src/config/pi-config.js";

describe("pi config", () => {
  it("uses fixed provider and model defaults", () => {
    expect(fixedPiProvider).toBe("openai-codex");
    expect(resolvePiModel({})).toBe("gpt-5.4");
    expect(resolvePiModel({ PI_MODEL: "gpt-5.4-mini" })).toBe("gpt-5.4-mini");
  });

  it("resolves thinking level", () => {
    expect(resolvePiThinkingLevel({ PI_THINKING_LEVEL: "high" })).toBe("high");
    expect(resolvePiThinkingLevel({})).toBeUndefined();
  });

  it("throws on invalid thinking", () => {
    expect(() => resolvePiThinkingLevel({ PI_THINKING_LEVEL: "bad" })).toThrow("Invalid PI_THINKING_LEVEL: bad");
  });
});
