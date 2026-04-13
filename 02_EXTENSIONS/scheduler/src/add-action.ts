import { DateTime } from "luxon";

import { describeScheduledTask, nextScheduledRunAt } from "./scheduler-time.js";
import type { ScheduledTaskRecord } from "../../../01_BOT/src/features/scheduler/scheduler-types.js";

import type { SchedulerToolInput } from "./schema.js";
import {
  defaultTimezone,
  makeId,
  response,
  scopeScheduledTasks,
  sortScheduledTasks,
  type ExecuteSchedulerDeps,
} from "./helpers.js";

export const addScheduledTaskAction = async (
  params: SchedulerToolInput,
  scopeId: string,
  sessionContext: NonNullable<ReturnType<NonNullable<ExecuteSchedulerDeps["getSessionContextFn"]>>>,
  tasksFile: string,
  currentScopeTasks: ScheduledTaskRecord[],
  deps: ExecuteSchedulerDeps & {
    mutateScheduledTasksFn: NonNullable<ExecuteSchedulerDeps["mutateScheduledTasksFn"]>;
  },
) => {
  const hasCron = typeof params.cron === "string" && params.cron.trim() !== "";
  if (!params.prompt || (!hasCron && !params.time)) {
    return response("add", currentScopeTasks, "Error: prompt and either cron or time required for add.", {
      error: "prompt and either cron or time required for add.",
    });
  }
  if (hasCron && (params.time || params.date)) {
    return response("add", currentScopeTasks, "Error: use cron for recurring schedules, or time/date for one-time schedules, not both.", {
      error: "use cron for recurring schedules, or time/date for one-time schedules, not both.",
    });
  }

  const timezone = defaultTimezone();
  try {
    const now = deps.now?.() ?? DateTime.now();
    const scheduledTask: ScheduledTaskRecord = {
      id: deps.createId?.() ?? makeId(),
      scopeId,
      authorId: sessionContext.discordContext.authorId,
      channelId: sessionContext.discordContext.channelId,
      channelName: sessionContext.discordContext.channelName,
      guildId: sessionContext.discordContext.guildId,
      guildName: sessionContext.discordContext.guildName,
      isDirectMessage: sessionContext.discordContext.isDirectMessage,
      recurrence: hasCron ? "cron" : "once",
      prompt: params.prompt,
      cron: hasCron ? params.cron : undefined,
      timezone,
      scheduledTime: params.time,
      scheduledDate: params.date,
      mentionUser: params.mentionUser ?? true,
      createdAt: now.toUTC().toISO()!,
      nextRunAt: nextScheduledRunAt({ cron: hasCron ? params.cron : undefined, time: params.time, date: params.date, timezone }, now),
    };
    const tasks = await deps.mutateScheduledTasksFn(tasksFile, async (existing) => ({
      tasks: sortScheduledTasks([...existing, scheduledTask]),
      result: scopeScheduledTasks([...existing, scheduledTask], scopeId),
    }));
    return response("add", tasks, `Scheduled ${scheduledTask.id} for ${describeScheduledTask(scheduledTask)} in fresh clean session.`, { created: scheduledTask });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return response("add", currentScopeTasks, `Error: ${message}`, { error: message });
  }
};
