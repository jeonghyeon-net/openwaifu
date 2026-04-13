import type { DiscordToolContext } from "../../integrations/discord/tools/discord-admin-types.js";

export const schedulerRecurrences = ["once", "daily"] as const;
export const schedulerToolActions = ["add", "list", "cancel"] as const;

export type SchedulerRecurrence = (typeof schedulerRecurrences)[number];
export type SchedulerToolAction = (typeof schedulerToolActions)[number];

export type SchedulerScope = DiscordToolContext & { scopeId: string };
export type ScheduledTaskRecord = SchedulerScope & {
  id: string;
  recurrence: SchedulerRecurrence;
  prompt: string;
  message?: string;
  timezone: string;
  scheduledTime: string;
  scheduledDate?: string;
  mentionUser: boolean;
  createdAt: string;
  nextRunAt: string;
  lastTriggeredAt?: string;
};

export type SchedulerToolDetails = {
  action: SchedulerToolAction;
  tasks: ScheduledTaskRecord[];
  created?: ScheduledTaskRecord;
  removedId?: string;
  error?: string;
};
