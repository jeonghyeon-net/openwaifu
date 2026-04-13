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
vi.mock("discord.js", () => ({ Events: { ClientReady: "ready" } }));
vi.mock("../src/config/env.js", () => ({
  env: {
    discordBotToken: "token",
    piProvider: "openai-codex",
    piModel: "model",
    piThinkingLevel: "high",
    piReasoningEffort: "low",
  },
}));
vi.mock("../src/config/paths.js", () => ({ paths: { repoRoot: "/repo", sessionsRoot: "/sessions", extensionsRoot: "/ext", skillsRoot: "/skills" } }));
vi.mock("../src/features/chat/chat-service.js", () => ({ createChatService }));
vi.mock("../src/features/scheduler/reminder-paths.js", () => ({ remindersFileForCwd: vi.fn(() => "/repo/01_BOT/.data/scheduler/reminders.json") }));
vi.mock("../src/features/scheduler/reminder-service.js", () => ({ createReminderService }));
vi.mock("../src/integrations/discord/client.js", () => ({ createDiscordClient }));
vi.mock("../src/integrations/discord/handlers.js", () => ({ registerDiscordHandlers }));
vi.mock("../src/integrations/pi/pi-runtime.js", () => ({ PiRuntime: { create } }));

beforeEach(() => {
  once.mockClear();
  login.mockClear();
  createDiscordClient.mockClear();
  createChatService.mockClear();
  registerDiscordHandlers.mockClear();
  create.mockClear();
  createReminderService.mockClear();
  startReminderService.mockClear();
  vi.resetModules();
});

describe("main", () => {
  it("wires runtime, handlers, and login", async () => {
    await import("../src/main.js");
    expect(createDiscordClient).toHaveBeenCalled();
    expect(create).toHaveBeenCalledWith({
      repoRoot: "/repo",
      sessionsRoot: "/sessions",
      extensionsRoot: "/ext",
      skillsRoot: "/skills",
      provider: "openai-codex",
      modelId: "model",
      thinkingLevel: "high",
      reasoningEffort: "low",
      discordClient: client,
    });
    expect(createChatService).toHaveBeenCalledWith(runtime);
    expect(createReminderService).toHaveBeenCalledWith({
      client,
      remindersFile: "/repo/01_BOT/.data/scheduler/reminders.json",
    });
    expect(registerDiscordHandlers).toHaveBeenCalled();
    expect(once).toHaveBeenCalledWith("ready", expect.any(Function));
    const onReady = once.mock.calls[0]?.[1];
    if (!onReady) throw new Error("ready handler missing");
    onReady({ user: { tag: "bot#0001" } });
    expect(startReminderService).toHaveBeenCalled();
    expect(login).toHaveBeenCalledWith("token");
  });
});
