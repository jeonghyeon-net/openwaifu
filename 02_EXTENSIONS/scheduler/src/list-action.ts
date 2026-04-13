import { describeReminder } from "../../../01_BOT/src/features/scheduler/reminder-time.js";
import type { ReminderRecord } from "../../../01_BOT/src/features/scheduler/reminder-types.js";

import { response } from "./helpers.js";

export const listReminderAction = (reminders: ReminderRecord[]) => {
  if (reminders.length === 0) return response("list", [], "No reminders scheduled.");
  const lines = reminders.map(
    (reminder) => `- ${reminder.id}: ${describeReminder(reminder)} -> ${reminder.message}`,
  );
  return response("list", reminders, lines.join("\n"));
};
