import { DateTime } from "luxon";

import {
  describeScheduledTask,
  nextScheduledRunAt,
} from "../../../01_BOT/src/features/scheduler/scheduler-time.js";
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
  if (!params.recurrence || !params.time || !params.prompt) {
    return response("add", currentScopeTasks, "Error: recurrence, time, and prompt required for add.", {
      error: "recurrence, time, and prompt required for add.",
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
      recurrence: params.recurrence,
      prompt: params.prompt,
      timezone,
      scheduledTime: params.time,
      scheduledDate: params.date,
      mentionUser: params.mentionUser ?? true,
      createdAt: now.toUTC().toISO()!,
      nextRunAt: nextScheduledRunAt({ recurrence: params.recurrence, time: params.time, date: params.date, timezone }, now),
    };
    const tasks = await deps.mutateScheduledTasksFn(tasksFile, async (existing) => ({
      reminders: sortScheduledTasks([...existing, scheduledTask]),
      result: scopeScheduledTasks([...existing, scheduledTask], scopeId),
    }));
    return response("add", tasks, `Scheduled ${scheduledTask.id} for ${describeScheduledTask(scheduledTask)} in fresh clean session.`, { created: scheduledTask });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return response("add", currentScopeTasks, `Error: ${message}`, { error: message });
  }
};
