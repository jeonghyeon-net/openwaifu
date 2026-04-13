import { Events } from "discord.js";
import { vi } from "vitest";

import { registerDiscordHandlers } from "../src/integrations/discord/handlers.js";

type HandlerClient = {
  on(event: string, handler: (message: unknown) => Promise<void>): void;
  user: { setPresence(args: { status: string; activities?: Array<{ name: string; state?: string; type: number }> }): void } | null;
};

export const attachments = (...items: Array<{ name: string | null; url: string; contentType: string | null; size: number }>) => ({
  values: () => items.values(),
});

export const textStream = (...texts: string[]) =>
  (async function* () {
    for (const text of texts) yield { type: "text" as const, text };
  })();

export const createHandlerEnv = (chatService: { stream: ReturnType<typeof vi.fn>; reply: ReturnType<typeof vi.fn> }, client: Partial<HandlerClient> = {}) => {
  const handlers = new Map<string, (message: unknown) => Promise<void>>();
  const resolvedClient = { user: null, ...client, on: vi.fn((event, handler) => handlers.set(event, handler)) };
  registerDiscordHandlers({ client: resolvedClient, chatService });
  const run = handlers.get(Events.MessageCreate);
  if (!run) throw new Error("handler missing");
  return { client: resolvedClient, run };
};

export const discordMessage = (overrides: Record<string, unknown> = {}) => ({
  id: "m",
  author: { bot: false, id: "u" },
  channel: { isDMBased: () => false, sendTyping: vi.fn(async () => undefined) },
  channelId: "c",
  content: "hello",
  reply: vi.fn(async () => ({ edit: vi.fn(async () => undefined) })),
  guildId: "g",
  attachments: attachments(),
  ...overrides,
});
