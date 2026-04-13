import { afterEach, describe, expect, it, vi } from "vitest";

import { paths } from "../src/config/paths.js";

vi.mock("dotenv", () => ({ config: vi.fn() }));

const baseEnv = { ...process.env };
const loadEnv = async (nextEnv: NodeJS.ProcessEnv) => {
  vi.resetModules();
  process.env = { ...baseEnv };
  for (const [key, value] of Object.entries(nextEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  return (await import("../src/config/env.js")).env;
};

afterEach(() => {
  process.env = { ...baseEnv };
  vi.resetModules();
});

describe("config", () => {
  it("builds repo paths from config file location", () => {
    expect(paths.botRoot.endsWith("/01_BOT")).toBe(true);
    expect(paths.repoRoot.endsWith("/openwaifu")).toBe(true);
    expect(paths.sessionsRoot.endsWith("/01_BOT/.data/sessions")).toBe(true);
  });

  it("loads token and defaults to openai-codex", async () => {
    const env = await loadEnv({
      DISCORD_BOT_TOKEN: "token",
      OPENAI_API_KEY: undefined,
      PI_MODEL: undefined,
      PI_PROVIDER: undefined,
      PI_REASONING_EFFORT: undefined,
      PI_THINKING_LEVEL: undefined,
    });
    expect(env).toEqual({
      discordBotToken: "token",
      piProvider: "openai-codex",
      piModel: "gpt-5.4",
      piThinkingLevel: undefined,
      piReasoningEffort: undefined,
    });
  });

  it("loads explicit thinking and effort", async () => {
    const env = await loadEnv({
      DISCORD_BOT_TOKEN: "token",
      OPENAI_API_KEY: "sk-test",
      PI_MODEL: undefined,
      PI_PROVIDER: undefined,
      PI_REASONING_EFFORT: "low",
      PI_THINKING_LEVEL: "high",
    });
    expect(env).toEqual({
      discordBotToken: "token",
      piProvider: "openai",
      piModel: "gpt-5.4",
      piThinkingLevel: "high",
      piReasoningEffort: "low",
    });
  });

  it("throws when DISCORD_BOT_TOKEN missing", async () => {
    await expect(loadEnv({ DISCORD_BOT_TOKEN: undefined })).rejects.toThrow("Missing DISCORD_BOT_TOKEN");
  });
});
