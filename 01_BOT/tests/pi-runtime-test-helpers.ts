import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { beforeEach, vi } from "vitest";
import type { ImageContent } from "@mariozechner/pi-ai";

import type { DiscordAdminClient } from "../src/integrations/discord/tools/discord-admin-types.js";

export type ModelInfo = { id: string; provider: string } | undefined;
export type PreparedPrompt = { prompt: string; images?: ImageContent[] };
export type SessionEvent = { type: string; message?: { role?: string }; assistantMessageEvent?: { type?: string; delta?: string } };
export type MockSessionManager = {
  getEntries: ReturnType<typeof vi.fn>;
  getSessionFile: ReturnType<typeof vi.fn>;
  getSessionId: ReturnType<typeof vi.fn>;
};
export type MockSession = {
  abort: ReturnType<typeof vi.fn>;
  dispose: ReturnType<typeof vi.fn>;
  prompt: ReturnType<typeof vi.fn>;
  subscribe: ReturnType<typeof vi.fn>;
  messages: unknown[];
  sessionManager: MockSessionManager;
};
export const find = vi.fn<(_provider?: string, _modelId?: string) => ModelInfo>(() => ({ id: "model", provider: "openai-codex" }));
export const open = vi.fn(() => "session-manager");
export const createResourceLoader = vi.fn(async () => ({ reload: vi.fn(async () => undefined) }));
export const lastAssistantText = vi.fn(() => "reply");
export const ensureProviderAuth = vi.fn(async () => undefined);
export const canUseDiscordManagementTools = vi.fn(async () => false);
export const prepareChatPrompt = vi.fn(async ({ prompt }: { prompt: string }): Promise<PreparedPrompt> => ({ prompt, images: undefined }));
export const createdSessions: MockSession[] = [];
let promptImpl: (session: MockSession, text: string, options: unknown) => Promise<void>;
const createSession = (): MockSession => {
  const listeners = new Set<(event: SessionEvent) => void>();
  const sessionManager = {
    getEntries: vi.fn(() => []),
    getSessionFile: vi.fn(() => "/tmp/mock-session.jsonl"),
    getSessionId: vi.fn(() => "session-1"),
  };
  const session = {
    abort: vi.fn(async () => undefined),
    dispose: vi.fn(() => undefined),
    prompt: vi.fn(async (text: string, options: unknown) => promptImpl(session, text, options)),
    subscribe: vi.fn((listener) => (listeners.add(listener), () => listeners.delete(listener))),
    messages: [],
    sessionManager,
  } as MockSession;
  (session as MockSession & { emit(event: SessionEvent): void }).emit = (event) => listeners.forEach((listener) => listener(event));
  return session;
};
const createPiSession = vi.fn(async () => (createdSessions.push(createSession()), createdSessions.at(-1)!));
vi.mock("@mariozechner/pi-coding-agent", async () => ({ ...(await vi.importActual<object>("@mariozechner/pi-coding-agent")), AuthStorage: { create: () => ({}) }, ModelRegistry: { create: () => ({ find }) }, SessionManager: { open }, SettingsManager: { create: () => ({}) }, getAgentDir: () => "/agent" }));
vi.mock("../src/features/chat/prepare-chat-prompt.js", () => ({ prepareChatPrompt }));
vi.mock("../src/integrations/pi/create-resource-loader.js", () => ({ createResourceLoader }));
vi.mock("../src/integrations/pi/create-session.js", () => ({ createPiSession }));
vi.mock("../src/integrations/pi/ensure-provider-auth.js", () => ({ ensureProviderAuth }));
vi.mock("../src/integrations/pi/last-assistant-text.js", () => ({ lastAssistantText }));
vi.mock("../src/integrations/discord/tools/discord-admin-access.js", () => ({ canUseDiscordManagementTools }));
beforeEach(() => {
  createdSessions.length = 0;
  find.mockReturnValue({ id: "model", provider: "openai-codex" });
  [ensureProviderAuth, canUseDiscordManagementTools, open, createPiSession, createResourceLoader, lastAssistantText].forEach((mock) => mock.mockClear());
  canUseDiscordManagementTools.mockResolvedValue(false);
  prepareChatPrompt.mockReset();
  prepareChatPrompt.mockImplementation(async ({ prompt }: { prompt: string }) => ({ prompt, images: undefined }));
  promptImpl = async (session, text) => (session as MockSession & { emit(event: SessionEvent): void }).emit({ type: "message_update", message: { role: "assistant" }, assistantMessageEvent: { type: "text_delta", delta: text } });
});
export const setPromptImpl = (next: typeof promptImpl) => {
  promptImpl = next;
};
export const discordClient = { guilds: {} as DiscordAdminClient["guilds"], channels: {} as DiscordAdminClient["channels"] } as DiscordAdminClient;
export const createRuntime = async () => {
  const { PiRuntime } = await import("../src/integrations/pi/pi-runtime.js");
  const sessionsRoot = mkdtempSync(join(tmpdir(), "pi-runtime-"));
  return PiRuntime.create({ repoRoot: "/repo", sessionsRoot, extensionsRoot: "/ext", skillsRoot: "/skills", modelId: "gpt-5.4", thinkingLevel: "high", discordClient });
};
