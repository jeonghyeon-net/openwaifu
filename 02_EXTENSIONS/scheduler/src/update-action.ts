import { DateTime } from "luxon";

import { describeScheduledTask } from "./scheduler-time.js";
import type { ScheduledTaskRecord } from "../../../01_BOT/src/features/scheduler/scheduler-types.js";

import type { SchedulerToolInput } from "./schema.js";
import { response, scopeScheduledTasks, sortScheduledTasks, type ExecuteSchedulerDeps } from "./helpers.js";
import { buildUpdatedSchedule, hasNonEmptyCron, hasUpdateFields } from "./update-action-helpers.js";

type UpdateResult = { updated?: ScheduledTaskRecord; tasks: ScheduledTaskRecord[] };

const updateError = (tasks: ScheduledTaskRecord[], message: string) =>
  response("update", tasks, `Error: ${message}`, { error: message });

export const updateScheduledTaskAction = async (
  params: SchedulerToolInput,
  scopeId: string,
  tasksFile: string,
  currentScopeTasks: ScheduledTaskRecord[],
  deps: ExecuteSchedulerDeps & { mutateScheduledTasksFn: NonNullable<ExecuteSchedulerDeps["mutateScheduledTasksFn"]> },
) => {
  if (!params.id) return updateError(currentScopeTasks, "id required for update.");
  if (!hasUpdateFields(params)) return updateError(currentScopeTasks, "provide at least one field to update.");
  if (typeof params.prompt === "string" && params.prompt.trim() === "") {
    return updateError(currentScopeTasks, "prompt cannot be empty for update.");
  }
  if (hasNonEmptyCron(params.cron) && (params.time || params.date)) {
    return updateError(currentScopeTasks, "use cron for recurring schedules, or time/date for one-time schedules, not both.");
  }

  try {
    const now = deps.now?.() ?? DateTime.now();
    const result = await deps.mutateScheduledTasksFn(tasksFile, async (existing) => {
      const scoped = scopeScheduledTasks(existing, scopeId);
      const current = scoped.find((task) => task.id === params.id);
      if (!current) return { tasks: existing, result: { tasks: scoped } satisfies UpdateResult };
      const updated: ScheduledTaskRecord = {
        ...current,
        ...buildUpdatedSchedule(current, params, now),
        ...(typeof params.prompt === "string" ? { prompt: params.prompt } : {}),
        ...(typeof params.mentionUser === "boolean" ? { mentionUser: params.mentionUser } : {}),
      };
      const tasks = sortScheduledTasks(existing.map((task) =>
        task.scopeId === scopeId && task.id === params.id ? updated : task));
      return { tasks, result: { updated, tasks: scopeScheduledTasks(tasks, scopeId) } satisfies UpdateResult };
    });
    if (!result.updated) {
      return response("update", result.tasks, `Scheduled task not found: ${params.id}`, { error: `Scheduled task not found: ${params.id}` });
    }
    return response("update", result.tasks, `Updated scheduled task ${params.id}: ${describeScheduledTask(result.updated)}.`, { updated: result.updated });
  } catch (error) {
    return updateError(currentScopeTasks, error instanceof Error ? error.message : String(error));
  }
};
