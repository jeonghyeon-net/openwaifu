import { response, scopeScheduledTasks, type ExecuteSchedulerDeps } from "./helpers.js";

export const cancelScheduledTaskAction = async (
  taskId: string | undefined,
  scopeId: string,
  tasksFile: string,
  currentScopeTasks: ReturnType<typeof scopeScheduledTasks>,
  deps: Pick<ExecuteSchedulerDeps, "mutateScheduledTasksFn"> & {
    mutateScheduledTasksFn: NonNullable<ExecuteSchedulerDeps["mutateScheduledTasksFn"]>;
  },
) => {
  if (!taskId) {
    return response("cancel", currentScopeTasks, "Error: id required for cancel.", {
      error: "id required for cancel.",
    });
  }

  const result = await deps.mutateScheduledTasksFn(tasksFile, async (existing) => {
    const scoped = scopeScheduledTasks(existing, scopeId);
    if (!scoped.some((scheduledTask) => scheduledTask.id === taskId)) {
      return { tasks: existing, result: { removed: false, tasks: scoped } };
    }
    const tasks = existing.filter(
      (scheduledTask) => !(scheduledTask.scopeId === scopeId && scheduledTask.id === taskId),
    );
    return { tasks, result: { removed: true, tasks: scopeScheduledTasks(tasks, scopeId) } };
  });

  if (!result.removed) {
    return response("cancel", result.tasks, `Scheduled task not found: ${taskId}`, {
      error: `Scheduled task not found: ${taskId}`,
    });
  }
  return response("cancel", result.tasks, `Cancelled scheduled task ${taskId}.`, { removedId: taskId });
};
