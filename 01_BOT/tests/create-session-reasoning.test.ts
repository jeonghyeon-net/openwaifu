import type { AuthStorage, ModelRegistry, ResourceLoader, SessionManager, SettingsManager } from "@mariozechner/pi-coding-agent";
import type { Api, Model } from "@mariozechner/pi-ai";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { DiscordAdminClient } from "../src/integrations/discord/tools/discord-admin-types.js";

type Args = { customTools: unknown[]; tools: Array<{ name: string }>; thinkingLevel?: string };
const bindExtensions = vi.fn(async () => undefined);
const createSession = (onPayload?: (payload: unknown, model: Model<Api>) => unknown) => ({ agent: { onPayload, state: {} }, bindExtensions });
const createAgentSession = vi.fn(async (options: Args) => ({ session: createSession(), options }));
vi.mock("@mariozechner/pi-coding-agent", async () => ({ ...(await vi.importActual<object>("@mariozechner/pi-coding-agent")), createAgentSession }));

const createModel = (provider: string, reasoning = true): Model<Api> => ({
  id: "m", name: "model", api: "openai-responses", baseUrl: "https://example.com", provider, reasoning,
  input: ["text"], cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }, contextWindow: 1, maxTokens: 1,
});
const discordClient = { channels: {} as DiscordAdminClient["channels"], guilds: {} as DiscordAdminClient["guilds"] } as DiscordAdminClient;

beforeEach(() => {
  bindExtensions.mockClear();
  createAgentSession.mockReset();
  createAgentSession.mockResolvedValue({ session: createSession(), options: { customTools: [], tools: [] } });
});

describe("createPiSession reasoning", () => {
  it("passes thinking level and wraps payload for reasoning effort", async () => {
    const onPayload = vi.fn(async () => undefined);
    createAgentSession.mockResolvedValueOnce({ session: createSession(onPayload), options: { customTools: [], tools: [] } });
    const { createPiSession } = await import("../src/integrations/pi/create-session.js");
    const session = await createPiSession({
      repoRoot: "/repo", agentDir: "/agent", authStorage: {} as AuthStorage, modelRegistry: {} as ModelRegistry,
      model: createModel("openai-codex"), thinkingLevel: "high", reasoningEffort: "low",
      settingsManager: {} as SettingsManager, resourceLoader: {} as ResourceLoader, sessionManager: {} as SessionManager,
      discordClient, discordContext: { authorId: "u", channelId: "c", guildId: "g", isDirectMessage: false },
    });
    expect(createAgentSession).toHaveBeenCalledWith(expect.objectContaining({ thinkingLevel: "high" }));
    await expect(session.agent.onPayload?.({ input: [] }, createModel("openai-codex"))).resolves.toEqual({
      include: ["reasoning.encrypted_content"], input: [], reasoning: { effort: "low", summary: "auto" },
    });
    expect(onPayload).toHaveBeenCalled();
  });
});
