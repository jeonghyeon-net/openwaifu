import { randomUUID } from "node:crypto";

import { schedulerFileForCwd } from "../../../01_BOT/src/features/scheduler/scheduler-paths.js";
import { listScheduledTasks, mutateScheduledTasks } from "../../../01_BOT/src/features/scheduler/scheduler-store.js";
import type {
  ScheduledTaskRecord,
  SchedulerToolAction,
  SchedulerToolDetails,
} from "../../../01_BOT/src/features/scheduler/scheduler-types.js";
import { getDiscordSessionContext } from "../../../01_BOT/src/integrations/pi/discord-session-context.js";

export type ExecuteSchedulerContext = { cwd: string; sessionFile?: string };
export type ExecuteSchedulerDeps = {
  now?: () => import("luxon").DateTime<true> | import("luxon").DateTime<false>;
  createId?: () => string;
  listScheduledTasksFn?: typeof listScheduledTasks;
  mutateScheduledTasksFn?: typeof mutateScheduledTasks;
  getSessionContextFn?: typeof getDiscordSessionContext;
};
export type SchedulerToolResponse = {
  content: Array<{ type: "text"; text: string }>;
  details: SchedulerToolDetails;
};

export const defaultTimezone = () => "Asia/Seoul";
export const makeId = () => randomUUID().slice(0, 8);
export const sortScheduledTasks = (tasks: ScheduledTaskRecord[]) =>
  [...tasks].sort((left, right) => left.nextRunAt.localeCompare(right.nextRunAt));
export const scopeScheduledTasks = (tasks: ScheduledTaskRecord[], scopeId: string) =>
  sortScheduledTasks(tasks.filter((scheduledTask) => scheduledTask.scopeId === scopeId));
export const response = (
  action: SchedulerToolAction,
  tasks: ScheduledTaskRecord[],
  text: string,
  extra: Omit<SchedulerToolDetails, "action" | "tasks"> = {},
): SchedulerToolResponse => ({ content: [{ type: "text", text }], details: { action, tasks, ...extra } });
export const resolveExecution = (ctx: ExecuteSchedulerContext, deps: ExecuteSchedulerDeps = {}) => ({
  tasksFile: schedulerFileForCwd(ctx.cwd),
  listScheduledTasksFn: deps.listScheduledTasksFn ?? listScheduledTasks,
  mutateScheduledTasksFn: deps.mutateScheduledTasksFn ?? mutateScheduledTasks,
  sessionContext: ctx.sessionFile ? (deps.getSessionContextFn ?? getDiscordSessionContext)(ctx.sessionFile) : undefined,
});
