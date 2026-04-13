import { randomUUID } from "node:crypto";

import { remindersFileForCwd } from "../../../01_BOT/src/features/scheduler/reminder-paths.js";
import { listReminders, mutateReminders } from "../../../01_BOT/src/features/scheduler/reminder-store.js";
import type {
  ReminderRecord,
  ReminderToolAction,
  ReminderToolDetails,
} from "../../../01_BOT/src/features/scheduler/reminder-types.js";
import { getDiscordSessionContext } from "../../../01_BOT/src/integrations/pi/discord-session-context.js";

export type ExecuteSchedulerContext = { cwd: string; sessionFile?: string };
export type ExecuteSchedulerDeps = {
  now?: () => import("luxon").DateTime<true> | import("luxon").DateTime<false>;
  createId?: () => string;
  listRemindersFn?: typeof listReminders;
  mutateRemindersFn?: typeof mutateReminders;
  getSessionContextFn?: typeof getDiscordSessionContext;
};
export type ReminderToolResponse = {
  content: Array<{ type: "text"; text: string }>;
  details: ReminderToolDetails;
};

export const defaultTimezone = () => "Asia/Seoul";
export const makeId = () => randomUUID().slice(0, 8);
export const sortReminders = (reminders: ReminderRecord[]) =>
  [...reminders].sort((left, right) => left.nextRunAt.localeCompare(right.nextRunAt));
export const scopeReminders = (reminders: ReminderRecord[], scopeId: string) =>
  sortReminders(reminders.filter((reminder) => reminder.scopeId === scopeId));
export const response = (
  action: ReminderToolAction,
  reminders: ReminderRecord[],
  text: string,
  extra: Omit<ReminderToolDetails, "action" | "reminders"> = {},
): ReminderToolResponse => ({ content: [{ type: "text", text }], details: { action, reminders, ...extra } });
export const resolveExecution = (ctx: ExecuteSchedulerContext, deps: ExecuteSchedulerDeps = {}) => ({
  remindersFile: remindersFileForCwd(ctx.cwd),
  listRemindersFn: deps.listRemindersFn ?? listReminders,
  mutateRemindersFn: deps.mutateRemindersFn ?? mutateReminders,
  sessionContext: ctx.sessionFile ? (deps.getSessionContextFn ?? getDiscordSessionContext)(ctx.sessionFile) : undefined,
});
