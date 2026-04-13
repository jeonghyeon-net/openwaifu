import { describe, expect, it } from "vitest";
import { DateTime } from "luxon";

import {
  describeScheduledTask,
  nextCronRunAt,
  nextScheduledRunAt,
  retryScheduledRunAt,
} from "../src/features/scheduler/scheduler-time.js";

describe("scheduler time helpers", () => {
  it("schedules next one-time run for same day when still in future", () => {
    const now = DateTime.fromISO("2026-04-13T08:00:00", { zone: "Asia/Seoul" });
    expect(nextScheduledRunAt({ time: "09:00", timezone: "Asia/Seoul" }, now)).toBe(
      "2026-04-13T00:00:00.000Z",
    );
  });

  it("moves implicit one-time run to next day when time already passed", () => {
    const now = DateTime.fromISO("2026-04-13T10:00:00", { zone: "Asia/Seoul" });
    expect(nextScheduledRunAt({ time: "09:00", timezone: "Asia/Seoul" }, now)).toBe(
      "2026-04-14T00:00:00.000Z",
    );
  });

  it("supports future dated runs and cron schedules", () => {
    const now = DateTime.fromISO("2026-04-13T08:00:00", { zone: "Asia/Seoul" });
    expect(nextScheduledRunAt({ time: "13:00", timezone: "Asia/Seoul" }, now)).toBe(
      "2026-04-13T04:00:00.000Z",
    );
    expect(
      nextScheduledRunAt(
        { date: "2026-04-14", time: "13:00", timezone: "Asia/Seoul" },
        now,
      ),
    ).toBe("2026-04-14T04:00:00.000Z");
    expect(nextScheduledRunAt({ cron: "0 9 * * *", timezone: "Asia/Seoul" }, now)).toBe(
      "2026-04-13T00:00:00.000Z",
    );
    expect(nextCronRunAt({ cron: "30 10 * * 1-5", timezone: "Asia/Seoul" }, now)).toBe(
      "2026-04-13T01:30:00.000Z",
    );
  });

  it("describes scheduled tasks and builds retry timestamps", () => {
    expect(
      describeScheduledTask({ recurrence: "cron", cron: "0 9 * * *", nextRunAt: "2026-04-14T00:00:00.000Z", timezone: "Asia/Seoul" }),
    ).toBe("cron 0 9 * * * (next 2026-04-14 09:00 Asia/Seoul)");
    expect(
      describeScheduledTask({ recurrence: "once", nextRunAt: "2026-04-14T04:00:00.000Z", timezone: "Asia/Seoul" }),
    ).toBe("2026-04-14 13:00 (Asia/Seoul)");
    expect(retryScheduledRunAt(DateTime.fromISO("2026-04-13T00:00:00Z"))).toBe("2026-04-13T00:05:00.000Z");
  });

  it("rejects invalid scheduler inputs", () => {
    const now = DateTime.fromISO("2026-04-13T08:00:00", { zone: "Asia/Seoul" });

    expect(() => nextScheduledRunAt({ time: "9:00", timezone: "Asia/Seoul" }, now)).toThrow("Invalid time");
    expect(() => nextScheduledRunAt({ date: "2026/04/14", time: "09:00", timezone: "Asia/Seoul" }, now)).toThrow("Invalid date");
    expect(() => nextScheduledRunAt({ time: "09:00", timezone: "Mars/Phobos" }, now)).toThrow("Invalid timezone");
    expect(() => nextScheduledRunAt({ date: "2026-02-30", time: "09:00", timezone: "Asia/Seoul" }, now)).toThrow("Invalid date/time");
    expect(() => nextScheduledRunAt({ date: "2026-04-13", time: "07:00", timezone: "Asia/Seoul" }, now)).toThrow("Scheduled time must be in future");
    expect(() => nextScheduledRunAt({ cron: "bad cron", timezone: "Asia/Seoul" }, now)).toThrow();
    expect(() => retryScheduledRunAt(DateTime.invalid("bad timestamp"))).toThrow("Failed to serialize scheduled task time");
  });
});
