import { beforeEach, vi } from "vitest";

export const once = vi.fn();
export const on = vi.fn();
export const login = vi.fn(async () => undefined);
export const client = { once, on, login };
export const runtime = { prompt: vi.fn(), runScheduledPrompt: vi.fn(async () => undefined) };
export const createDiscordClient = vi.fn(() => client);
export const createChatService = vi.fn(() => ({ reply: vi.fn() }));
export const registerDiscordHandlers = vi.fn();
export const registerDiscordSessionHandlers = vi.fn();
export const syncDiscordSessionCommands = vi.fn(async () => undefined);
export const startSchedulerService = vi.fn();
export const createSchedulerService = vi.fn((_args: { tasksFile: string; runTask: (task: Record<string, unknown>) => Promise<void> }) => ({ start: startSchedulerService }));
export const create = vi.fn(async () => runtime);
export const setCustomStatus = vi.fn();
export const presenceService = { setBusy: vi.fn(), setCustomStatus };
export const createDiscordPresenceService = vi.fn(() => presenceService);
export const startChatGptQuotaStatusService = vi.fn();
export const reportChatGptQuotaStatusError = vi.fn();
export const createChatGptQuotaStatusService = vi.fn((_args: { onStatusText: (text: string) => void; onError?: (error: unknown) => void }) => ({ start: startChatGptQuotaStatusService }));
export const baseTask = { authorId: "u", channelId: "c", channelName: "general", guildId: "g", guildName: "guild", isDirectMessage: false, timezone: "Asia/Seoul", recurrence: "once", scheduledTime: "09:00", mentionUser: true, createdAt: "2026-04-13T00:00:00.000Z", nextRunAt: "2026-04-13T00:01:00.000Z" };

vi.mock("discord.js", () => ({ Events: { ClientReady: "ready", InteractionCreate: "interactionCreate" }, ApplicationCommandOptionType: { Subcommand: 1 } }));
vi.mock("../src/config/env.js", () => ({ env: { discordBotToken: "token", piModel: "model", piThinkingLevel: "high" } }));
vi.mock("../src/config/paths.js", () => ({ paths: { repoRoot: "/repo", sessionsRoot: "/sessions", extensionsRoot: "/ext", skillsRoot: "/skills" } }));
vi.mock("../src/features/chat/chat-service.js", () => ({ createChatService }));
vi.mock("../src/features/chatgpt-quota/chatgpt-quota-service.js", () => ({ createChatGptQuotaStatusService, reportChatGptQuotaStatusError }));
vi.mock("../src/features/scheduler/scheduler-paths.js", () => ({ schedulerFileForCwd: vi.fn(() => "/repo/01_BOT/.data/scheduler/scheduled-tasks.json") }));
vi.mock("../src/features/scheduler/scheduler-service.js", () => ({ createSchedulerService }));
vi.mock("../src/integrations/discord/client.js", () => ({ createDiscordClient }));
vi.mock("../src/integrations/discord/handlers.js", () => ({ registerDiscordHandlers }));
vi.mock("../src/integrations/discord/presence-service.js", () => ({ createDiscordPresenceService }));
vi.mock("../src/integrations/discord/session-commands.js", () => ({ registerDiscordSessionHandlers, syncDiscordSessionCommands }));
vi.mock("../src/integrations/pi/pi-runtime.js", () => ({ PiRuntime: { create } }));

beforeEach(() => {
  [once, on, login, createDiscordClient, runtime.prompt, runtime.runScheduledPrompt, createChatService, createChatGptQuotaStatusService, reportChatGptQuotaStatusError, createDiscordPresenceService, registerDiscordHandlers, registerDiscordSessionHandlers, syncDiscordSessionCommands, create, createSchedulerService, setCustomStatus, startChatGptQuotaStatusService, startSchedulerService].forEach((mock) => mock.mockClear());
  syncDiscordSessionCommands.mockResolvedValue(undefined);
  vi.resetModules();
});

export const loadMain = () => import("../src/main.js");
export const quotaServiceArgs = () => createChatGptQuotaStatusService.mock.calls[0]?.[0];
export const schedulerServiceArgs = () => createSchedulerService.mock.calls[0]?.[0];
export const readyHandler = () => once.mock.calls[0]?.[1];
