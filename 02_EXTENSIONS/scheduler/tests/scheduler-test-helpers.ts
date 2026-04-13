import { rm } from "node:fs/promises";

import type { ScheduledTaskRecord } from "../../../01_BOT/src/features/scheduler/scheduler-types.js";
import { executeSchedulerAction, type SchedulerToolInput } from "../src/scheduler.js";

export const schedulerTempRoots: string[] = [];
export const schedulerSessionContext = {
  scopeId: "scope:1",
  discordContext: {
    authorId: "user-1",
    channelId: "channel-1",
    guildId: "guild-1",
    isDirectMessage: false,
  },
};

export const schedulerTask = (overrides: Partial<ScheduledTaskRecord>): ScheduledTaskRecord => ({
  id: "task-1",
  scopeId: "scope:1",
  authorId: "user-1",
  channelId: "channel-1",
  guildId: "guild-1",
  isDirectMessage: false,
  recurrence: "once",
  prompt: "wake up",
  timezone: "Asia/Seoul",
  scheduledTime: "09:00",
  mentionUser: true,
  createdAt: "2026-04-13T00:00:00.000Z",
  nextRunAt: "2026-04-13T00:00:00.000Z",
  ...overrides,
});

export const runScheduler = async (
  params: SchedulerToolInput,
  tasks: ScheduledTaskRecord[],
  extra: { sessionFile?: string; deps?: Parameters<typeof executeSchedulerAction>[2] } = {},
) => {
  let stored = [...tasks];
  const result = await executeSchedulerAction(
    params,
    { cwd: "/repo", sessionFile: extra.sessionFile ?? "/tmp/session.jsonl" },
    {
      createId: () => "new-id",
      getSessionContextFn: (sessionFile) =>
        sessionFile === "/tmp/session.jsonl" ? schedulerSessionContext : undefined,
      listScheduledTasksFn: async () => stored,
      mutateScheduledTasksFn: async (_file, mutate) => {
        const next = await mutate(stored);
        stored = next.tasks;
        return next.result;
      },
      ...extra.deps,
    },
  );
  return { result, stored };
};

export const cleanupSchedulerTempRoots = async () => {
  delete process.env.BOT_TIMEZONE;
  await Promise.all(schedulerTempRoots.splice(0).map((path) => rm(path, { recursive: true, force: true })));
};
