import { DateTime } from "luxon";

import {
  describeScheduledTask,
  nextScheduledRunAt,
} from "../../../01_BOT/src/features/scheduler/scheduler-time.js";
import type { ScheduledTaskRecord } from "../../../01_BOT/src/features/scheduler/scheduler-types.js";

import type { SchedulerToolInput } from "./schema.js";
import {
  response,
  scopeScheduledTasks,
  sortScheduledTasks,
  type ExecuteSchedulerDeps,
} from "./helpers.js";

type UpdateResult = {
  updated?: ScheduledTaskRecord;
  tasks: ScheduledTaskRecord[];
};

const hasNonEmptyCron = (cron: string | undefined) =>
  typeof cron === "string" && cron.trim() !== "";

const hasUpdateFields = (params: SchedulerToolInput) =>
  typeof params.prompt === "string"
  || typeof params.mentionUser === "boolean"
  || typeof params.time === "string"
  || typeof params.date === "string"
  || typeof params.cron === "string";

const buildUpdatedSchedule = (
  current: ScheduledTaskRecord,
  params: SchedulerToolInput,
  now: DateTime<true> | DateTime<false>,
) => {
  const timezone = current.timezone;
  const hasCron = hasNonEmptyCron(params.cron);

  if (hasCron) {
    return {
      recurrence: "cron" as const,
      cron: params.cron,
      scheduledTime: undefined,
      scheduledDate: undefined,
      nextRunAt: nextScheduledRunAt({ cron: params.cron, timezone }, now),
    };
  }

  if (typeof params.time === "string" || typeof params.date === "string") {
    const scheduledTime = typeof params.time === "string"
      ? params.time
      : current.recurrence === "once"
        ? current.scheduledTime
        : undefined;
    if (!scheduledTime) throw new Error("time required when updating one-time schedule.");
    const scheduledDate = typeof params.time === "string"
      ? params.date
      : params.date;
    return {
      recurrence: "once" as const,
      cron: undefined,
      scheduledTime,
      scheduledDate,
      nextRunAt: nextScheduledRunAt({ time: scheduledTime, date: scheduledDate, timezone }, now),
    };
  }

  return {
    recurrence: current.recurrence,
    cron: current.cron,
    scheduledTime: current.scheduledTime,
    scheduledDate: current.scheduledDate,
    nextRunAt: current.nextRunAt,
  };
};

export const updateScheduledTaskAction = async (
  params: SchedulerToolInput,
  scopeId: string,
  tasksFile: string,
  currentScopeTasks: ScheduledTaskRecord[],
  deps: ExecuteSchedulerDeps & {
    mutateScheduledTasksFn: NonNullable<ExecuteSchedulerDeps["mutateScheduledTasksFn"]>;
  },
) => {
  if (!params.id) {
    return response("update", currentScopeTasks, "Error: id required for update.", {
      error: "id required for update.",
    });
  }
  if (!hasUpdateFields(params)) {
    return response("update", currentScopeTasks, "Error: provide at least one field to update.", {
      error: "provide at least one field to update.",
    });
  }
  if (typeof params.prompt === "string" && params.prompt.trim() === "") {
    return response("update", currentScopeTasks, "Error: prompt cannot be empty for update.", {
      error: "prompt cannot be empty for update.",
    });
  }
  if (hasNonEmptyCron(params.cron) && (params.time || params.date)) {
    return response("update", currentScopeTasks, "Error: use cron for recurring schedules, or time/date for one-time schedules, not both.", {
      error: "use cron for recurring schedules, or time/date for one-time schedules, not both.",
    });
  }

  try {
    const now = deps.now?.() ?? DateTime.now();
    const result = await deps.mutateScheduledTasksFn(tasksFile, async (existing): Promise<{ tasks: ScheduledTaskRecord[]; result: UpdateResult }> => {
      const scoped = scopeScheduledTasks(existing, scopeId);
      const current = scoped.find((scheduledTask) => scheduledTask.id === params.id);
      if (!current) return { tasks: existing, result: { tasks: scoped } };

      const schedule = buildUpdatedSchedule(current, params, now);
      const updated: ScheduledTaskRecord = {
        ...current,
        ...schedule,
        ...(typeof params.prompt === "string" ? { prompt: params.prompt } : {}),
        ...(typeof params.mentionUser === "boolean" ? { mentionUser: params.mentionUser } : {}),
      };
      const tasks = sortScheduledTasks(existing.map((scheduledTask) =>
        scheduledTask.scopeId === scopeId && scheduledTask.id === params.id
          ? updated
          : scheduledTask));
      return { tasks, result: { updated, tasks: scopeScheduledTasks(tasks, scopeId) } };
    });

    if (!result.updated) {
      return response("update", result.tasks, `Scheduled task not found: ${params.id}`, {
        error: `Scheduled task not found: ${params.id}`,
      });
    }

    return response("update", result.tasks, `Updated scheduled task ${params.id}: ${describeScheduledTask(result.updated)}.`, {
      updated: result.updated,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return response("update", currentScopeTasks, `Error: ${message}`, { error: message });
  }
};
