import { DateTime } from "luxon";

import {
  describeReminder,
  nextReminderRunAt,
} from "../../../01_BOT/src/features/scheduler/reminder-time.js";
import type { ReminderRecord } from "../../../01_BOT/src/features/scheduler/reminder-types.js";

import type { SchedulerToolInput } from "./schema.js";
import {
  defaultTimezone,
  makeId,
  response,
  scopeReminders,
  sortReminders,
  type ExecuteSchedulerDeps,
} from "./helpers.js";

export const addReminderAction = async (
  params: SchedulerToolInput,
  scopeId: string,
  sessionContext: NonNullable<ReturnType<NonNullable<ExecuteSchedulerDeps["getSessionContextFn"]>>>,
  remindersFile: string,
  currentScopeReminders: ReminderRecord[],
  deps: ExecuteSchedulerDeps & {
    mutateRemindersFn: NonNullable<ExecuteSchedulerDeps["mutateRemindersFn"]>;
  },
) => {
  if (!params.recurrence || !params.time || !params.message) {
    return response("add", currentScopeReminders, "Error: recurrence, time, and message required for add.", {
      error: "recurrence, time, and message required for add.",
    });
  }

  const timezone = defaultTimezone();
  try {
    const now = deps.now?.() ?? DateTime.now();
    const reminder: ReminderRecord = {
      id: deps.createId?.() ?? makeId(),
      scopeId,
      authorId: sessionContext.discordContext.authorId,
      channelId: sessionContext.discordContext.channelId,
      guildId: sessionContext.discordContext.guildId,
      isDirectMessage: sessionContext.discordContext.isDirectMessage,
      recurrence: params.recurrence,
      message: params.message,
      timezone,
      scheduledTime: params.time,
      scheduledDate: params.date,
      mentionUser: params.mentionUser ?? true,
      createdAt: now.toUTC().toISO()!,
      nextRunAt: nextReminderRunAt({ recurrence: params.recurrence, time: params.time, date: params.date, timezone }, now),
    };
    const reminders = await deps.mutateRemindersFn(remindersFile, async (existing) => ({
      reminders: sortReminders([...existing, reminder]),
      result: scopeReminders([...existing, reminder], scopeId),
    }));
    return response("add", reminders, `Scheduled ${reminder.id} for ${describeReminder(reminder)}.`, { created: reminder });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return response("add", currentScopeReminders, `Error: ${message}`, { error: message });
  }
};
