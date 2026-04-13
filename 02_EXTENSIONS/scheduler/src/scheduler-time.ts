import { CronExpressionParser } from "cron-parser";
import { DateTime } from "luxon";

import type { ScheduledTaskRecord } from "../../../01_BOT/src/features/scheduler/scheduler-types.js";

const timePattern = /^([01]\d|2[0-3]):([0-5]\d)$/;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
type AnyDateTime = DateTime<true> | DateTime<false>;
type Input = { timezone: string; time?: string; date?: string; cron?: string };

const toUtcIso = (value: AnyDateTime) => {
  const iso = value.toUTC().toISO();
  if (!iso) throw new Error("Failed to serialize scheduled task time");
  return iso;
};
const parseTime = (time: string) => {
  const match = timePattern.exec(time);
  if (!match) throw new Error(`Invalid time: ${time}. Use HH:mm.`);
  return { hour: Number(match[1]), minute: Number(match[2]) };
};
const assertDate = (date?: string) => {
  if (date === undefined || datePattern.test(date)) return;
  throw new Error(`Invalid date: ${date}. Use YYYY-MM-DD.`);
};
const assertTimezone = (timezone: string) => {
  if (DateTime.now().setZone(timezone).isValid) return;
  throw new Error(`Invalid timezone: ${timezone}`);
};

export const nextScheduledRunAt = (input: Input, now: AnyDateTime = DateTime.now()) => {
  assertTimezone(input.timezone);
  assertDate(input.date);
  const zonedNow = now.setZone(input.timezone);
  if (input.cron) {
    const interval = CronExpressionParser.parse(input.cron, { currentDate: zonedNow.toJSDate(), tz: input.timezone });
    return toUtcIso(DateTime.fromJSDate(interval.next().toDate(), { zone: input.timezone }));
  }
  if (!input.time) throw new Error("Time required when cron is not set");
  const { hour, minute } = parseTime(input.time);
  if (input.date) {
    const scheduled = DateTime.fromISO(`${input.date}T${input.time}`, { zone: input.timezone, setZone: true });
    if (!scheduled.isValid) throw new Error(`Invalid date/time: ${input.date} ${input.time}`);
    if (scheduled <= zonedNow) throw new Error("Scheduled time must be in future");
    return toUtcIso(scheduled);
  }
  const scheduled = zonedNow.set({ hour, minute, second: 0, millisecond: 0 });
  return toUtcIso(scheduled <= zonedNow ? scheduled.plus({ days: 1 }) : scheduled);
};

export const describeScheduledTask = (task: Pick<ScheduledTaskRecord, "recurrence" | "nextRunAt" | "timezone" | "cron">) => {
  const runAt = DateTime.fromISO(task.nextRunAt, { zone: "utc" }).setZone(task.timezone);
  return task.recurrence === "cron" && task.cron
    ? `cron ${task.cron} (next ${runAt.toFormat("yyyy-LL-dd HH:mm")} ${task.timezone})`
    : `${runAt.toFormat("yyyy-LL-dd HH:mm")} (${task.timezone})`;
};
