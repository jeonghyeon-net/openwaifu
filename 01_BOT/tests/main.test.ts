import { beforeEach, describe, expect, it, vi } from "vitest";

const once = vi.fn();
const on = vi.fn();
const login = vi.fn(async () => undefined);
const client = { once, on, login };
const runtime = { prompt: vi.fn(), runScheduledPrompt: vi.fn(async () => "scheduled reply") };
const createDiscordClient = vi.fn(() => client);
const createChatService = vi.fn(() => ({ reply: vi.fn() }));
const registerDiscordHandlers = vi.fn();
const registerDiscordSessionHandlers = vi.fn();
const syncDiscordSessionCommands = vi.fn(async () => undefined);
const startSchedulerService = vi.fn();
const createSchedulerService = vi.fn(
  (_args: { client: unknown; tasksFile: string; runTask: (task: Record<string, unknown>) => Promise<string> }) => ({ start: startSchedulerService }),
);
const create = vi.fn(async () => runtime);
const setCustomStatus = vi.fn();
const presenceService = { setBusy: vi.fn(), setCustomStatus };
const createDiscordPresenceService = vi.fn(() => presenceService);
const startChatGptQuotaStatusService = vi.fn();
const createChatGptQuotaStatusService = vi.fn(
  (_args: { onStatusText: (text: string) => void; onError?: (error: Error) => void }) => ({ start: startChatGptQuotaStatusService }),
);

vi.mock("discord.js", () => ({
  Events: { ClientReady: "ready", InteractionCreate: "interactionCreate" },
  ApplicationCommandOptionType: { Subcommand: 1 },
}));
vi.mock("../src/config/env.js", () => ({ env: { discordBotToken: "token", piModel: "model", piThinkingLevel: "high" } }));
vi.mock("../src/config/paths.js", () => ({ paths: { repoRoot: "/repo", sessionsRoot: "/sessions", extensionsRoot: "/ext", skillsRoot: "/skills" } }));
vi.mock("../src/features/chat/chat-service.js", () => ({ createChatService }));
vi.mock("../src/features/chatgpt-quota/chatgpt-quota-service.js", () => ({ createChatGptQuotaStatusService }));
vi.mock("../src/features/scheduler/scheduler-paths.js", () => ({ schedulerFileForCwd: vi.fn(() => "/repo/01_BOT/.data/scheduler/scheduled-tasks.json") }));
vi.mock("../src/features/scheduler/scheduler-service.js", () => ({ createSchedulerService }));
vi.mock("../src/integrations/discord/client.js", () => ({ createDiscordClient }));
vi.mock("../src/integrations/discord/handlers.js", () => ({ registerDiscordHandlers }));
vi.mock("../src/integrations/discord/presence-service.js", () => ({ createDiscordPresenceService }));
vi.mock("../src/integrations/discord/session-commands.js", () => ({ registerDiscordSessionHandlers, syncDiscordSessionCommands }));
vi.mock("../src/integrations/pi/pi-runtime.js", () => ({ PiRuntime: { create } }));

beforeEach(() => {
  once.mockClear();
  on.mockClear();
  login.mockClear();
  createDiscordClient.mockClear();
  runtime.prompt.mockClear();
  runtime.runScheduledPrompt.mockClear();
  createChatService.mockClear();
  createChatGptQuotaStatusService.mockClear();
  createDiscordPresenceService.mockClear();
  registerDiscordHandlers.mockClear();
  registerDiscordSessionHandlers.mockClear();
  syncDiscordSessionCommands.mockClear();
  create.mockClear();
  createSchedulerService.mockClear();
  setCustomStatus.mockClear();
  startChatGptQuotaStatusService.mockClear();
  startSchedulerService.mockClear();
  vi.resetModules();
});

describe("main", () => {
  it("wires runtime, quota status, handlers, and login", async () => {
    await import("../src/main.js");

    expect(createDiscordClient).toHaveBeenCalled();
    expect(create).toHaveBeenCalledWith({
      repoRoot: "/repo",
      sessionsRoot: "/sessions",
      extensionsRoot: "/ext",
      skillsRoot: "/skills",
      modelId: "model",
      thinkingLevel: "high",
      discordClient: client,
    });
    expect(createChatService).toHaveBeenCalledWith(runtime);
    expect(createSchedulerService).toHaveBeenCalledWith({
      client,
      tasksFile: "/repo/01_BOT/.data/scheduler/scheduled-tasks.json",
      runTask: expect.any(Function),
    });
    expect(createDiscordPresenceService).toHaveBeenCalledWith(client);
    expect(createChatGptQuotaStatusService).toHaveBeenCalledWith({
      onStatusText: expect.any(Function),
      onError: expect.any(Function),
    });
    expect(registerDiscordHandlers).toHaveBeenCalledWith({ client, chatService: createChatService.mock.results[0]?.value, presenceService });
    expect(registerDiscordSessionHandlers).toHaveBeenCalledWith({ client, sessionService: runtime });
    expect(once).toHaveBeenCalledWith("ready", expect.any(Function));

    const quotaServiceArgs = createChatGptQuotaStatusService.mock.calls[0]?.[0];
    if (!quotaServiceArgs) throw new Error("quota status service args missing");
    quotaServiceArgs.onStatusText("5h 35% used · Weekly 62% used");
    expect(setCustomStatus).toHaveBeenCalledWith("5h 35% used · Weekly 62% used");
    quotaServiceArgs.onError?.(new Error("boom"));

    const schedulerServiceArgs = createSchedulerService.mock.calls[0]?.[0];
    if (!schedulerServiceArgs) throw new Error("scheduler service args missing");
    const baseTask = {
      authorId: "u",
      channelId: "c",
      channelName: "general",
      guildId: "g",
      guildName: "guild",
      isDirectMessage: false,
      timezone: "Asia/Seoul",
      recurrence: "once",
      scheduledTime: "09:00",
      mentionUser: true,
      createdAt: "2026-04-13T00:00:00.000Z",
      nextRunAt: "2026-04-13T00:01:00.000Z",
    };
    await expect(schedulerServiceArgs.runTask({
      ...baseTask,
      id: "sched-1",
      scopeId: "scope:1",
      prompt: "do thing",
    })).resolves.toBe("scheduled reply");
    expect(runtime.runScheduledPrompt).toHaveBeenNthCalledWith(
      1,
      "scope:1",
      "sched-1",
      "do thing",
      {
        authorId: "u",
        channelId: "c",
        channelName: "general",
        guildId: "g",
        guildName: "guild",
        isDirectMessage: false,
      },
    );
    await expect(schedulerServiceArgs.runTask({
      ...baseTask,
      id: "sched-2",
      scopeId: "scope:2",
      prompt: "",
      message: "fallback message",
    })).resolves.toBe("scheduled reply");
    expect(runtime.runScheduledPrompt).toHaveBeenNthCalledWith(
      2,
      "scope:2",
      "sched-2",
      "fallback message",
      {
        authorId: "u",
        channelId: "c",
        channelName: "general",
        guildId: "g",
        guildName: "guild",
        isDirectMessage: false,
      },
    );
    await expect(schedulerServiceArgs.runTask({
      ...baseTask,
      id: "sched-3",
      scopeId: "scope:3",
      prompt: "",
      message: "",
    })).resolves.toBe("scheduled reply");
    expect(runtime.runScheduledPrompt).toHaveBeenNthCalledWith(
      3,
      "scope:3",
      "sched-3",
      "",
      {
        authorId: "u",
        channelId: "c",
        channelName: "general",
        guildId: "g",
        guildName: "guild",
        isDirectMessage: false,
      },
    );

    const onReady = once.mock.calls[0]?.[1];
    if (!onReady) throw new Error("ready handler missing");
    const readyClient = { user: { tag: "bot#0001" } };
    onReady(readyClient);
    expect(syncDiscordSessionCommands).toHaveBeenCalledWith(readyClient);
    syncDiscordSessionCommands.mockRejectedValueOnce(new Error("sync fail"));
    onReady(readyClient);
    await Promise.resolve();
    expect(startSchedulerService).toHaveBeenCalled();
    expect(startChatGptQuotaStatusService).toHaveBeenCalled();
    expect(login).toHaveBeenCalledWith("token");
  });
});
