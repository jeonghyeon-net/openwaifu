import { rm } from "node:fs/promises";

import type { ReminderRecord } from "../src/features/scheduler/reminder-types.js";

export const reminderServiceTempRoots: string[] = [];
export const reminderServiceClient = {
  channels: {},
  guilds: {},
} as import("../src/integrations/discord/tools/discord-admin-types.js").DiscordAdminClient;

export const reminder = (overrides: Partial<ReminderRecord>): ReminderRecord => ({
  id: "rem-1",
  scopeId: "scope:1",
  authorId: "user-1",
  channelId: "channel-1",
  guildId: "guild-1",
  isDirectMessage: false,
  recurrence: "once",
  message: "wake up",
  timezone: "Asia/Seoul",
  scheduledTime: "09:00",
  mentionUser: true,
  createdAt: "2026-04-13T00:00:00.000Z",
  nextRunAt: "2026-04-13T00:00:00.000Z",
  ...overrides,
});

export const cleanupReminderServiceTempRoots = async () => {
  await Promise.all(
    reminderServiceTempRoots.splice(0).map((path) => rm(path, { recursive: true, force: true })),
  );
};
