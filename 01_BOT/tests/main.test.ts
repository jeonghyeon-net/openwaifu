import { beforeEach, describe, expect, it, vi } from "vitest";

const once = vi.fn();
const login = vi.fn(async () => undefined);
const client = { once, login };
const runtime = { prompt: vi.fn() };
const createDiscordClient = vi.fn(() => client);
const createChatService = vi.fn(() => ({ reply: vi.fn() }));
const registerDiscordHandlers = vi.fn();
const startReminderService = vi.fn();
const createReminderService = vi.fn(() => ({ start: startReminderService }));
const create = vi.fn(async () => runtime);
const setCustomStatus = vi.fn();
const presenceService = { setBusy: vi.fn(), setCustomStatus };
const createDiscordPresenceService = vi.fn(() => presenceService);
const startChatGptQuotaStatusService = vi.fn();
const createChatGptQuotaStatusService = vi.fn(() => ({ start: startChatGptQuotaStatusService }));

vi.mock("discord.js", () => ({ Events: { ClientReady: "ready" } }));
vi.mock("../src/config/env.js", () => ({ env: { discordBotToken: "token", piModel: "model", piThinkingLevel: "high" } }));
vi.mock("../src/config/paths.js", () => ({ paths: { repoRoot: "/repo", sessionsRoot: "/sessions", extensionsRoot: "/ext", skillsRoot: "/skills" } }));
vi.mock("../src/features/chat/chat-service.js", () => ({ createChatService }));
vi.mock("../src/features/chatgpt-quota/chatgpt-quota-service.js", () => ({ createChatGptQuotaStatusService }));
vi.mock("../src/features/scheduler/reminder-paths.js", () => ({ remindersFileForCwd: vi.fn(() => "/repo/01_BOT/.data/scheduler/reminders.json") }));
vi.mock("../src/features/scheduler/reminder-service.js", () => ({ createReminderService }));
vi.mock("../src/integrations/discord/client.js", () => ({ createDiscordClient }));
vi.mock("../src/integrations/discord/handlers.js", () => ({ registerDiscordHandlers }));
vi.mock("../src/integrations/discord/presence-service.js", () => ({ createDiscordPresenceService }));
vi.mock("../src/integrations/pi/pi-runtime.js", () => ({ PiRuntime: { create } }));

beforeEach(() => {
  once.mockClear();
  login.mockClear();
  createDiscordClient.mockClear();
  createChatService.mockClear();
  createChatGptQuotaStatusService.mockClear();
  createDiscordPresenceService.mockClear();
  registerDiscordHandlers.mockClear();
  create.mockClear();
  createReminderService.mockClear();
  setCustomStatus.mockClear();
  startChatGptQuotaStatusService.mockClear();
  startReminderService.mockClear();
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
    expect(createReminderService).toHaveBeenCalledWith({
      client,
      remindersFile: "/repo/01_BOT/.data/scheduler/reminders.json",
    });
    expect(createDiscordPresenceService).toHaveBeenCalledWith(client);
    expect(createChatGptQuotaStatusService).toHaveBeenCalledWith({
      onStatusText: expect.any(Function),
      onError: expect.any(Function),
    });
    expect(registerDiscordHandlers).toHaveBeenCalledWith({ client, chatService: createChatService.mock.results[0]?.value, presenceService });
    expect(once).toHaveBeenCalledWith("ready", expect.any(Function));

    const quotaServiceArgs = ((createChatGptQuotaStatusService.mock.calls[0] as unknown as [any]) || [])[0];
    if (!quotaServiceArgs) throw new Error("quota status service args missing");
    quotaServiceArgs.onStatusText("5h 35% used · Weekly 62% used");
    expect(setCustomStatus).toHaveBeenCalledWith("5h 35% used · Weekly 62% used");
    quotaServiceArgs.onError?.(new Error("boom"));

    const onReady = once.mock.calls[0]?.[1];
    if (!onReady) throw new Error("ready handler missing");
    onReady({ user: { tag: "bot#0001" } });
    expect(startReminderService).toHaveBeenCalled();
    expect(startChatGptQuotaStatusService).toHaveBeenCalled();
    expect(login).toHaveBeenCalledWith("token");
  });
});
