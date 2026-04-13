import { createRequire } from "node:module";
import { DateTime } from "luxon";

import type { ScheduledTaskRecord } from "./scheduler-types.js";

const require = createRequire(import.meta.url);
const timePattern = /^([01]\d|2[0-3]):([0-5]\d)$/;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
type NextScheduledInput = { timezone: string; time?: string; date?: string; cron?: string };
type AnyDateTime = DateTime<true> | DateTime<false>;
type CronParserModule = typeof import("cron-parser");
let cronParser: CronParserModule["CronExpressionParser"] | undefined;

const getCronExpressionParser = () => {
  if (cronParser) return cronParser;
  ({ CronExpressionParser: cronParser } = require("cron-parser") as CronParserModule);
  return cronParser;
};

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
const scheduleClock = (value: AnyDateTime, hour: number, minute: number) =>
  value.set({ hour, minute, second: 0, millisecond: 0 });
const assertCron = (cron?: string, timezone?: string) => {
  if (!cron) return;
  getCronExpressionParser().parse(cron, {
    currentDate: new Date(),
    tz: timezone,
  });
};

export const nextScheduledRunAt = (input: NextScheduledInput, now: AnyDateTime = DateTime.now()) => {
  assertTimezone(input.timezone);
  assertDate(input.date);
  assertCron(input.cron, input.timezone);
  const zonedNow = now.setZone(input.timezone);

  if (input.cron) {
    const interval = getCronExpressionParser().parse(input.cron, {
      currentDate: zonedNow.toJSDate(),
      tz: input.timezone,
    });
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

  const scheduled = scheduleClock(zonedNow, hour, minute);
  return toUtcIso(scheduled <= zonedNow ? scheduled.plus({ days: 1 }) : scheduled);
};

export const nextCronRunAt = (
  task: Pick<ScheduledTaskRecord, "cron" | "timezone">,
  now: AnyDateTime = DateTime.now(),
) => {
  if (!task.cron) throw new Error("Cron expression required for recurring scheduled task");
  return nextScheduledRunAt({ cron: task.cron, timezone: task.timezone }, now);
};

export const describeScheduledTask = (
  task: Pick<ScheduledTaskRecord, "recurrence" | "nextRunAt" | "timezone" | "cron">,
) => {
  const runAt = DateTime.fromISO(task.nextRunAt, { zone: "utc" }).setZone(task.timezone);
  if (task.recurrence === "cron" && task.cron) {
    return `cron ${task.cron} (next ${runAt.toFormat("yyyy-LL-dd HH:mm")} ${task.timezone})`;
  }
  return `${runAt.toFormat("yyyy-LL-dd HH:mm")} (${task.timezone})`;
};

export const retryScheduledRunAt = (now: AnyDateTime = DateTime.now()) =>
  toUtcIso(now.plus({ minutes: 5 }));
