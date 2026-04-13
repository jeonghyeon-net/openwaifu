import { beforeEach, describe, expect, it, vi } from "vitest";

const once = vi.fn();
const login = vi.fn(async () => undefined);
const client = { once, login };
const runtime = { prompt: vi.fn() };
const createDiscordClient = vi.fn(() => client);
const createChatService = vi.fn(() => ({ reply: vi.fn() }));
const registerDiscordHandlers = vi.fn();
const create = vi.fn(async () => runtime);
vi.mock("discord.js", () => ({ Events: { ClientReady: "ready" } }));
vi.mock("../src/config/env", () => ({ env: { discordBotToken: "token", piModel: "model" } }));
vi.mock("../src/config/paths", () => ({ paths: { repoRoot: "/repo", sessionsRoot: "/sessions", extensionsRoot: "/ext", skillsRoot: "/skills" } }));
vi.mock("../src/features/chat/chat-service", () => ({ createChatService }));
vi.mock("../src/integrations/discord/client", () => ({ createDiscordClient }));
vi.mock("../src/integrations/discord/handlers", () => ({ registerDiscordHandlers }));
vi.mock("../src/integrations/pi/pi-runtime", () => ({ PiRuntime: { create } }));

beforeEach(() => {
  once.mockClear();
  login.mockClear();
  createDiscordClient.mockClear();
  createChatService.mockClear();
  registerDiscordHandlers.mockClear();
  create.mockClear();
  vi.resetModules();
});

describe("main", () => {
  it("wires runtime, handlers, and login", async () => {
    await import("../src/main");
    expect(createDiscordClient).toHaveBeenCalled();
    expect(create).toHaveBeenCalledWith({ repoRoot: "/repo", sessionsRoot: "/sessions", extensionsRoot: "/ext", skillsRoot: "/skills", modelId: "model", discordClient: client });
    expect(createChatService).toHaveBeenCalledWith(runtime);
    expect(registerDiscordHandlers).toHaveBeenCalled();
    expect(once).toHaveBeenCalledWith("ready", expect.any(Function));
    expect(login).toHaveBeenCalledWith("token");
  });
});
