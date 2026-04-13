import type { AuthStorage, ModelRegistry, ResourceLoader, SessionManager, SettingsManager } from "@mariozechner/pi-coding-agent";
import type { Api, Model } from "@mariozechner/pi-ai";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { DiscordAdminClient } from "../src/integrations/discord/tools/discord-admin-types.js";

const registerDiscordSessionContext = vi.fn();
vi.mock("../src/integrations/pi/discord-session-context.js", () => ({ registerDiscordSessionContext }));

type Args = { customTools: unknown[]; tools: Array<{ name: string }>; thinkingLevel?: string };
const bindExtensions = vi.fn(async () => undefined);
const createSession = () => ({
  agent: { state: { systemPrompt: "BASE TOOLS\n`scheduler`: create, list, or cancel one-time and daily scheduled tasks" } },
  _baseSystemPrompt: "BASE TOOLS\n`scheduler`: create, list, or cancel one-time and daily scheduled tasks",
  bindExtensions,
});
const createAgentSession = vi.fn(async (options: Args) => ({ session: createSession(), options }));
vi.mock("@mariozechner/pi-coding-agent", async () => ({ ...(await vi.importActual<object>("@mariozechner/pi-coding-agent")), createAgentSession }));

const createModel = (provider: string): Model<Api> => ({
  id: "m", name: "model", api: "openai-responses", baseUrl: "https://example.com", provider, reasoning: false,
  input: ["text"], cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }, contextWindow: 1, maxTokens: 1,
});
const discordClient = { channels: {} as DiscordAdminClient["channels"], guilds: {} as DiscordAdminClient["guilds"] } as DiscordAdminClient;

beforeEach(() => {
  bindExtensions.mockClear();
  createAgentSession.mockReset();
  registerDiscordSessionContext.mockClear();
  createAgentSession.mockResolvedValue({ session: createSession(), options: { customTools: [], tools: [] } });
});

describe("createPiSession", () => {
  it("wires runtime and discord tools into agent session", async () => {
    const { createPiSession } = await import("../src/integrations/pi/create-session.js");
    const session = await createPiSession({
      repoRoot: "/repo", agentDir: "/agent", authStorage: {} as AuthStorage, modelRegistry: {} as ModelRegistry,
      model: createModel("openai-codex"), settingsManager: {} as SettingsManager, resourceLoader: {} as ResourceLoader,
      sessionManager: { getSessionFile: () => "/sessions/scope.jsonl" } as SessionManager, scopeId: "scope:1", discordClient,
      discordContext: { authorId: "u", channelId: "c", channelName: "개발", guildId: "g", guildName: "jeonghyeon.net", isDirectMessage: false },
    });
    const args = createAgentSession.mock.calls[0]?.[0];
    if (!args) throw new Error("createAgentSession args missing");
    expect(args.customTools).toHaveLength(9);
    expect(args.tools.map((tool) => tool.name)).toEqual(["read", "bash", "edit", "write", "grep", "find", "ls"]);
    expect(session.agent.state.systemPrompt).toContain("BASE TOOLS");
    expect(session.agent.state.systemPrompt).toContain("`scheduler`: create, list, or cancel one-time and daily scheduled tasks");
    expect(session.agent.state.systemPrompt).toContain("discord_* tools");
    expect(Reflect.get(session, "_baseSystemPrompt")).toContain("`scheduler`: create, list, or cancel one-time and daily scheduled tasks");
    expect(Reflect.get(session, "_baseSystemPrompt")).toContain("discord_* tools");
    expect(session.agent.state.systemPrompt).toContain("answer from current_* context fields first");
    expect(session.agent.state.systemPrompt).toContain("current_channel_id: c");
    expect(session.agent.state.systemPrompt).toContain("current_channel_name: 개발");
    expect(bindExtensions).toHaveBeenCalledWith({});
    expect(registerDiscordSessionContext).toHaveBeenCalledWith("/sessions/scope.jsonl", "scope:1", {
      authorId: "u",
      channelId: "c",
      channelName: "개발",
      guildId: "g",
      guildName: "jeonghyeon.net",
      isDirectMessage: false,
    });
  });
});
