import { Events } from "discord.js";
import { vi } from "vitest";

import { registerDiscordSessionHandlers } from "../src/integrations/discord/session-commands.js";

export const createSessionCommandEnv = () => {
  const handlers = new Map<string, (interaction: unknown) => Promise<void>>();
  const client = {
    on: vi.fn((event: string, handler: (interaction: unknown) => Promise<void>) => handlers.set(event, handler)),
  };
  const sessionService = {
    getScopeStats: vi.fn(),
    resetScope: vi.fn(async () => undefined),
  };
  registerDiscordSessionHandlers({ client, sessionService });
  const run = handlers.get(Events.InteractionCreate);
  if (!run) throw new Error("interaction handler missing");
  return { sessionService, run };
};

export const discordInteraction = (overrides: Record<string, unknown> = {}) => ({
  isChatInputCommand: () => true,
  commandName: "session",
  user: { id: "u" },
  channelId: "c",
  guildId: "g",
  channel: { isDMBased: () => false },
  options: { getSubcommand: () => "usage" },
  reply: vi.fn(async () => undefined),
  ...overrides,
});
