import { rm } from "node:fs/promises";

import type { ScheduledTaskRecord } from "../src/features/scheduler/scheduler-types.js";

export const schedulerServiceTempRoots: string[] = [];
export const schedulerServiceClient = {
  channels: {},
  guilds: {},
} as import("../src/integrations/discord/tools/discord-admin-types.js").DiscordAdminClient;

export const reminder = (overrides: Partial<ScheduledTaskRecord>): ScheduledTaskRecord => ({
  id: "rem-1",
  scopeId: "scope:1",
  authorId: "user-1",
  channelId: "channel-1",
  guildId: "guild-1",
  isDirectMessage: false,
  recurrence: "once",
  prompt: "wake up",
  message: "wake up",
  timezone: "Asia/Seoul",
  scheduledTime: "09:00",
  mentionUser: true,
  createdAt: "2026-04-13T00:00:00.000Z",
  nextRunAt: "2026-04-13T00:00:00.000Z",
  ...overrides,
});

export const cleanupSchedulerServiceTempRoots = async () => {
  await Promise.all(
    schedulerServiceTempRoots.splice(0).map((path) => rm(path, { recursive: true, force: true })),
  );
};
