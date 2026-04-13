import { addScheduledTaskAction } from "./add-action.js";
import { cancelScheduledTaskAction } from "./cancel-action.js";
import { resolveExecution, response, scopeScheduledTasks, type ExecuteSchedulerContext, type ExecuteSchedulerDeps } from "./helpers.js";
import { listScheduledTaskAction } from "./list-action.js";
import type { SchedulerToolInput } from "./schema.js";
import { updateScheduledTaskAction } from "./update-action.js";

export const executeSchedulerAction = async (
  params: SchedulerToolInput,
  ctx: ExecuteSchedulerContext,
  deps: ExecuteSchedulerDeps = {},
) => {
  const resolved = resolveExecution(ctx, deps);
  if (!resolved.sessionContext) {
    return response(params.action, [], "Error: Discord session context unavailable.", {
      error: "Discord session context unavailable.",
    });
  }

  const currentTasks = await resolved.listScheduledTasksFn(resolved.tasksFile);
  const currentScopeTasks = scopeScheduledTasks(currentTasks, resolved.sessionContext.scopeId);
  if (params.action === "list") return listScheduledTaskAction(currentScopeTasks);
  if (params.action === "cancel") {
    return cancelScheduledTaskAction(params.id, resolved.sessionContext.scopeId, resolved.tasksFile, currentScopeTasks, {
      mutateScheduledTasksFn: resolved.mutateScheduledTasksFn,
    });
  }
  if (params.action === "update") {
    return updateScheduledTaskAction(params, resolved.sessionContext.scopeId, resolved.tasksFile, currentScopeTasks, {
      ...deps,
      mutateScheduledTasksFn: resolved.mutateScheduledTasksFn,
    });
  }
  return addScheduledTaskAction(
    params,
    resolved.sessionContext.scopeId,
    resolved.sessionContext,
    resolved.tasksFile,
    currentScopeTasks,
    { ...deps, mutateScheduledTasksFn: resolved.mutateScheduledTasksFn },
  );
};
