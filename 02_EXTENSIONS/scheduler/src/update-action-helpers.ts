import { DateTime } from "luxon";

import { nextScheduledRunAt } from "./scheduler-time.js";
import type { ScheduledTaskRecord } from "../../../01_BOT/src/features/scheduler/scheduler-types.js";

import type { SchedulerToolInput } from "./schema.js";

export const hasNonEmptyCron = (cron: string | undefined) =>
  typeof cron === "string" && cron.trim() !== "";

export const hasUpdateFields = (params: SchedulerToolInput) =>
  typeof params.prompt === "string"
  || typeof params.mentionUser === "boolean"
  || typeof params.time === "string"
  || typeof params.date === "string"
  || typeof params.cron === "string";

export const buildUpdatedSchedule = (
  current: ScheduledTaskRecord,
  params: SchedulerToolInput,
  now: DateTime<true> | DateTime<false>,
) => {
  const timezone = current.timezone;
  if (hasNonEmptyCron(params.cron)) {
    return {
      recurrence: "cron" as const,
      cron: params.cron,
      scheduledTime: undefined,
      scheduledDate: undefined,
      nextRunAt: nextScheduledRunAt({ cron: params.cron, timezone }, now),
    };
  }
  if (typeof params.time === "string" || typeof params.date === "string") {
    const scheduledTime = typeof params.time === "string"
      ? params.time
      : current.recurrence === "once"
        ? current.scheduledTime
        : undefined;
    if (!scheduledTime) throw new Error("time required when updating one-time schedule.");
    const scheduledDate = typeof params.date === "string"
      ? params.date
      : current.recurrence === "once"
        ? current.scheduledDate
        : undefined;
    return {
      recurrence: "once" as const,
      cron: undefined,
      scheduledTime,
      scheduledDate,
      nextRunAt: nextScheduledRunAt({ time: scheduledTime, date: scheduledDate, timezone }, now),
    };
  }
  return {
    recurrence: current.recurrence,
    cron: current.cron,
    scheduledTime: current.scheduledTime,
    scheduledDate: current.scheduledDate,
    nextRunAt: current.nextRunAt,
  };
};
