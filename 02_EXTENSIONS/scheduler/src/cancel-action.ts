import { response, scopeReminders, type ExecuteSchedulerDeps } from "./helpers.js";

export const cancelReminderAction = async (
  reminderId: string | undefined,
  scopeId: string,
  remindersFile: string,
  currentScopeReminders: ReturnType<typeof scopeReminders>,
  deps: Pick<ExecuteSchedulerDeps, "mutateRemindersFn"> & {
    mutateRemindersFn: NonNullable<ExecuteSchedulerDeps["mutateRemindersFn"]>;
  },
) => {
  if (!reminderId) {
    return response("cancel", currentScopeReminders, "Error: id required for cancel.", {
      error: "id required for cancel.",
    });
  }

  const result = await deps.mutateRemindersFn(remindersFile, async (existing) => {
    const scoped = scopeReminders(existing, scopeId);
    if (!scoped.some((reminder) => reminder.id === reminderId)) {
      return { reminders: existing, result: { removed: false, reminders: scoped } };
    }
    const reminders = existing.filter(
      (reminder) => !(reminder.scopeId === scopeId && reminder.id === reminderId),
    );
    return { reminders, result: { removed: true, reminders: scopeReminders(reminders, scopeId) } };
  });

  if (!result.removed) {
    return response("cancel", result.reminders, `Reminder not found: ${reminderId}`, {
      error: `Reminder not found: ${reminderId}`,
    });
  }
  return response("cancel", result.reminders, `Cancelled reminder ${reminderId}.`, { removedId: reminderId });
};
