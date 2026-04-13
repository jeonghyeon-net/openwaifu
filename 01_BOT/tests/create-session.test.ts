import { beforeEach, describe, expect, it, vi } from "vitest";

const bindExtensions = vi.fn(async () => undefined);
const createAgentSession = vi.fn(async (options: object) => ({ session: { agent: { state: {} }, bindExtensions }, options }));
vi.mock("@mariozechner/pi-coding-agent", async () => {
  const actual = await vi.importActual<object>("@mariozechner/pi-coding-agent");
  return { ...actual, createAgentSession };
});

beforeEach(() => {
  bindExtensions.mockClear();
  createAgentSession.mockClear();
});

describe("createPiSession", () => {
  it("wires runtime and discord tools into agent session", async () => {
    const { createPiSession } = await import("../src/integrations/pi/create-session");
    const session = await createPiSession({
      repoRoot: "/repo",
      agentDir: "/agent",
      authStorage: {},
      modelRegistry: {},
      model: { id: "m", provider: "anthropic" },
      settingsManager: {},
      resourceLoader: {},
      sessionManager: {},
      discordClient: {},
      discordContext: { authorId: "u", channelId: "c", guildId: "g", isDirectMessage: false },
    });
    expect(createAgentSession).toHaveBeenCalled();
    const args = createAgentSession.mock.calls[0]?.[0];
    expect(args.customTools).toHaveLength(9);
    expect(args.tools.map((tool: { name: string }) => tool.name)).toEqual(["read", "bash", "edit", "write", "grep", "find", "ls"]);
    expect(session.agent.state.systemPrompt).toContain("discord_* tools");
    expect(session.agent.state.systemPrompt).toContain("current_channel_id: c");
    expect(bindExtensions).toHaveBeenCalledWith({});
  });
});
