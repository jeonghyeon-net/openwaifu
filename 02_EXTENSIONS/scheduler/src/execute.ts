import { addReminderAction } from "./add-action.js";
import { cancelReminderAction } from "./cancel-action.js";
import { resolveExecution, response, scopeReminders, type ExecuteSchedulerContext, type ExecuteSchedulerDeps } from "./helpers.js";
import { listReminderAction } from "./list-action.js";
import type { SchedulerToolInput } from "./schema.js";

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

  const currentReminders = await resolved.listRemindersFn(resolved.remindersFile);
  const currentScopeReminders = scopeReminders(currentReminders, resolved.sessionContext.scopeId);
  if (params.action === "list") return listReminderAction(currentScopeReminders);
  if (params.action === "cancel") {
    return cancelReminderAction(params.id, resolved.sessionContext.scopeId, resolved.remindersFile, currentScopeReminders, {
      mutateRemindersFn: resolved.mutateRemindersFn,
    });
  }
  return addReminderAction(
    params,
    resolved.sessionContext.scopeId,
    resolved.sessionContext,
    resolved.remindersFile,
    currentScopeReminders,
    { ...deps, mutateRemindersFn: resolved.mutateRemindersFn },
  );
};
