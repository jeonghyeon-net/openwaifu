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

  it("loads token and pi defaults", async () => {
    const env = await loadEnv({
      DISCORD_BOT_TOKEN: "token",
      PI_MODEL: undefined,
      PI_THINKING_LEVEL: undefined,
    });
    expect(env).toEqual({
      discordBotToken: "token",
      piModel: "gpt-5.4",
      piThinkingLevel: undefined,
    });
  });

  it("loads explicit model and thinking level", async () => {
    const env = await loadEnv({
      DISCORD_BOT_TOKEN: "token",
      PI_MODEL: "gpt-5.4-mini",
      PI_THINKING_LEVEL: "high",
    });
    expect(env).toEqual({
      discordBotToken: "token",
      piModel: "gpt-5.4-mini",
      piThinkingLevel: "high",
    });
  });

  it("throws when DISCORD_BOT_TOKEN missing", async () => {
    await expect(loadEnv({ DISCORD_BOT_TOKEN: undefined })).rejects.toThrow("Missing DISCORD_BOT_TOKEN");
  });
});
