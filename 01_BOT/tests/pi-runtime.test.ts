import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { beforeEach, describe, expect, it, vi } from "vitest";

import type { DiscordAdminClient } from "../src/integrations/discord/tools/discord-admin-types.js";

const find = vi.fn(
  (_provider?: string, _modelId?: string): { id: string; provider: string } | undefined => ({
    id: "model",
    provider: "openai-codex",
  }),
);
const open = vi.fn(() => "session-manager");
const createResourceLoader = vi.fn(async () => ({ reload: vi.fn(async () => undefined) }));
const lastAssistantText = vi.fn(() => "reply");
const createPiSession = vi.fn(async () => ({ dispose: vi.fn(), prompt: vi.fn(async () => undefined) }));
const ensureProviderAuth = vi.fn(async () => undefined);
vi.mock("@mariozechner/pi-coding-agent", async () => {
  const actual = await vi.importActual<object>("@mariozechner/pi-coding-agent");
  return {
    ...actual,
    AuthStorage: { create: () => ({}) },
    ModelRegistry: { create: () => ({ find }) },
    SessionManager: { open },
    SettingsManager: { create: () => ({}) },
    getAgentDir: () => "/agent",
  };
});
vi.mock("../src/integrations/pi/create-resource-loader.js", () => ({ createResourceLoader }));
vi.mock("../src/integrations/pi/create-session.js", () => ({ createPiSession }));
vi.mock("../src/integrations/pi/ensure-provider-auth.js", () => ({ ensureProviderAuth }));
vi.mock("../src/integrations/pi/last-assistant-text.js", () => ({ lastAssistantText }));

beforeEach(() => {
  find.mockReturnValue({ id: "model", provider: "openai-codex" });
  ensureProviderAuth.mockClear();
  open.mockClear();
  createPiSession.mockClear();
  createResourceLoader.mockClear();
  lastAssistantText.mockClear();
});

const discordClient = {
  guilds: {} as DiscordAdminClient["guilds"],
  channels: {} as DiscordAdminClient["channels"],
} as DiscordAdminClient;

describe("PiRuntime", () => {
  it("creates loader and reuses session per scope", async () => {
    const { PiRuntime } = await import("../src/integrations/pi/pi-runtime.js");
    const sessionsRoot = mkdtempSync(join(tmpdir(), "pi-runtime-"));
    const runtime = await PiRuntime.create({ repoRoot: "/repo", sessionsRoot, extensionsRoot: "/ext", skillsRoot: "/skills", provider: "openai-codex", modelId: "gpt-5.4", thinkingLevel: "high", reasoningEffort: "low", discordClient });
    await expect(runtime.prompt("scope:a", "hello", { authorId: "u", channelId: "c", guildId: "g", isDirectMessage: false })).resolves.toBe("reply");
    await runtime.prompt("scope:a", "again", { authorId: "u", channelId: "c", guildId: "g", isDirectMessage: false });
    expect(ensureProviderAuth).toHaveBeenCalledWith({}, "openai-codex");
    expect(createResourceLoader).toHaveBeenCalled();
    expect(createPiSession).toHaveBeenCalledTimes(1);
    expect(createPiSession).toHaveBeenCalledWith(expect.objectContaining({ thinkingLevel: "high", reasoningEffort: "low" }));
    expect(open).toHaveBeenCalledWith(`${sessionsRoot}/scope_a.jsonl`, sessionsRoot, "/repo");
  });

  it("creates fresh session for new scope and missing model fails", async () => {
    const { PiRuntime } = await import("../src/integrations/pi/pi-runtime.js");
    const sessionsRoot = mkdtempSync(join(tmpdir(), "pi-runtime-"));
    const runtime = await PiRuntime.create({ repoRoot: "/repo", sessionsRoot, extensionsRoot: "/ext", skillsRoot: "/skills", provider: "openai-codex", modelId: "gpt-5.4", thinkingLevel: "high", reasoningEffort: "low", discordClient });
    await runtime.prompt("scope:a", "one", { authorId: "u", channelId: "a", guildId: "g", isDirectMessage: false });
    await runtime.prompt("scope:b", "two", { authorId: "u", channelId: "b", guildId: "g", isDirectMessage: false });
    expect(createPiSession).toHaveBeenCalledTimes(2);
    find.mockReturnValueOnce(undefined);
    await expect(PiRuntime.create({ repoRoot: "/repo", sessionsRoot, extensionsRoot: "/ext", skillsRoot: "/skills", provider: "openai-codex", modelId: "gpt-5.4", thinkingLevel: "high", reasoningEffort: "low", discordClient })).rejects.toThrow("Model not found");
  });
});
