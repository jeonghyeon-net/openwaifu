import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ImageContent } from "@mariozechner/pi-ai";

import type { DiscordAdminClient } from "../src/integrations/discord/tools/discord-admin-types.js";

type ModelInfo = { id: string; provider: string } | undefined;
type PreparedPrompt = { prompt: string; images?: ImageContent[] };

const find = vi.fn<(_provider?: string, _modelId?: string) => ModelInfo>(() => ({ id: "model", provider: "openai-codex" }));
const open = vi.fn(() => "session-manager");
const createResourceLoader = vi.fn(async () => ({ reload: vi.fn(async () => undefined) }));
const lastAssistantText = vi.fn(() => "reply");
const prompt = vi.fn(async () => undefined);
const createPiSession = vi.fn(async () => ({ dispose: vi.fn(), prompt }));
const ensureProviderAuth = vi.fn(async () => undefined);
const prepareChatPrompt = vi.fn(async ({ prompt }: { prompt: string }): Promise<PreparedPrompt> => ({ prompt, images: undefined }));
vi.mock("@mariozechner/pi-coding-agent", async () => ({ ...(await vi.importActual<object>("@mariozechner/pi-coding-agent")), AuthStorage: { create: () => ({}) }, ModelRegistry: { create: () => ({ find }) }, SessionManager: { open }, SettingsManager: { create: () => ({}) }, getAgentDir: () => "/agent" }));
vi.mock("../src/features/chat/prepare-chat-prompt.js", () => ({ prepareChatPrompt }));
vi.mock("../src/integrations/pi/create-resource-loader.js", () => ({ createResourceLoader }));
vi.mock("../src/integrations/pi/create-session.js", () => ({ createPiSession }));
vi.mock("../src/integrations/pi/ensure-provider-auth.js", () => ({ ensureProviderAuth }));
vi.mock("../src/integrations/pi/last-assistant-text.js", () => ({ lastAssistantText }));

beforeEach(() => {
  find.mockReturnValue({ id: "model", provider: "openai-codex" });
  ensureProviderAuth.mockClear();
  open.mockClear();
  prompt.mockClear();
  createPiSession.mockClear();
  createResourceLoader.mockClear();
  lastAssistantText.mockClear();
  prepareChatPrompt.mockReset();
  prepareChatPrompt.mockResolvedValue({ prompt: "hello", images: undefined });
});

const discordClient = { guilds: {} as DiscordAdminClient["guilds"], channels: {} as DiscordAdminClient["channels"] } as DiscordAdminClient;

describe("PiRuntime", () => {
  it("creates loader, reuses sessions, and prepares attachment-aware prompts", async () => {
    const { PiRuntime } = await import("../src/integrations/pi/pi-runtime.js");
    const sessionsRoot = mkdtempSync(join(tmpdir(), "pi-runtime-"));
    const runtime = await PiRuntime.create({ repoRoot: "/repo", sessionsRoot, extensionsRoot: "/ext", skillsRoot: "/skills", provider: "openai-codex", modelId: "gpt-5.4", thinkingLevel: "high", reasoningEffort: "low", discordClient });
    await expect(runtime.prompt("scope:a", "hello", { authorId: "u", channelId: "c", guildId: "g", isDirectMessage: false }, { messageId: "m1", attachments: [{ name: "notes.txt", url: "u", size: 1 }] })).resolves.toBe("reply");
    await runtime.prompt("scope:a", "again", { authorId: "u", channelId: "c", guildId: "g", isDirectMessage: false });
    expect(prepareChatPrompt).toHaveBeenCalledWith({ repoRoot: "/repo", scopeId: "scope:a", messageId: "m1", prompt: "hello", attachments: [{ name: "notes.txt", url: "u", size: 1 }] });
    expect(prompt).toHaveBeenCalledWith("hello", undefined);
    expect(createPiSession).toHaveBeenCalledTimes(1);
    expect(open).toHaveBeenCalledWith(`${sessionsRoot}/scope_a.jsonl`, sessionsRoot, "/repo");
  });

  it("passes prompt images, creates fresh session per scope, and fails on missing model", async () => {
    prepareChatPrompt.mockResolvedValueOnce({ prompt: "with image", images: [{ type: "image", data: "abc", mimeType: "image/png" }] });
    const { PiRuntime } = await import("../src/integrations/pi/pi-runtime.js");
    const sessionsRoot = mkdtempSync(join(tmpdir(), "pi-runtime-"));
    const runtime = await PiRuntime.create({ repoRoot: "/repo", sessionsRoot, extensionsRoot: "/ext", skillsRoot: "/skills", provider: "openai-codex", modelId: "gpt-5.4", thinkingLevel: "high", reasoningEffort: "low", discordClient });
    await runtime.prompt("scope:a", "one", { authorId: "u", channelId: "a", guildId: "g", isDirectMessage: false }, { messageId: "m2", attachments: [] });
    await runtime.prompt("scope:b", "two", { authorId: "u", channelId: "b", guildId: "g", isDirectMessage: false });
    expect(prompt).toHaveBeenCalledWith("with image", { images: [{ type: "image", data: "abc", mimeType: "image/png" }] });
    expect(createPiSession).toHaveBeenCalledTimes(2);
    find.mockReturnValueOnce(undefined);
    await expect(PiRuntime.create({ repoRoot: "/repo", sessionsRoot, extensionsRoot: "/ext", skillsRoot: "/skills", provider: "openai-codex", modelId: "gpt-5.4", thinkingLevel: "high", reasoningEffort: "low", discordClient })).rejects.toThrow("Model not found");
  });
});
