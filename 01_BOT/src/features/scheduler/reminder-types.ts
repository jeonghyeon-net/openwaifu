import type { DiscordToolContext } from "../../integrations/discord/tools/discord-admin-types.js";

export const reminderRecurrences = ["once", "daily"] as const;
export const reminderToolActions = ["add", "list", "cancel"] as const;

export type ReminderRecurrence = (typeof reminderRecurrences)[number];
export type ReminderToolAction = (typeof reminderToolActions)[number];

export type ReminderScope = DiscordToolContext & { scopeId: string };
export type ReminderRecord = ReminderScope & {
  id: string;
  recurrence: ReminderRecurrence;
  message: string;
  timezone: string;
  scheduledTime: string;
  scheduledDate?: string;
  mentionUser: boolean;
  createdAt: string;
  nextRunAt: string;
  lastTriggeredAt?: string;
};

export type ReminderToolDetails = {
  action: ReminderToolAction;
  reminders: ReminderRecord[];
  created?: ReminderRecord;
  removedId?: string;
  error?: string;
};
