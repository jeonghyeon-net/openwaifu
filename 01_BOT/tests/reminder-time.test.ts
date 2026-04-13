import { describe, expect, it } from "vitest";
import { DateTime } from "luxon";

import {
  describeReminder,
  nextDailyRunAt,
  nextReminderRunAt,
  retryReminderRunAt,
} from "../src/features/scheduler/reminder-time.js";

describe("reminder time helpers", () => {
  it("schedules daily reminder for same day when still in future", () => {
    const now = DateTime.fromISO("2026-04-13T08:00:00", { zone: "Asia/Seoul" });
    expect(nextReminderRunAt({ recurrence: "daily", time: "09:00", timezone: "Asia/Seoul" }, now)).toBe(
      "2026-04-13T00:00:00.000Z",
    );
  });

  it("moves daily and implicit once reminder to next day when time already passed", () => {
    const now = DateTime.fromISO("2026-04-13T10:00:00", { zone: "Asia/Seoul" });
    expect(nextReminderRunAt({ recurrence: "daily", time: "09:00", timezone: "Asia/Seoul" }, now)).toBe(
      "2026-04-14T00:00:00.000Z",
    );
    expect(nextReminderRunAt({ recurrence: "once", time: "09:00", timezone: "Asia/Seoul" }, now)).toBe(
      "2026-04-14T00:00:00.000Z",
    );
  });

  it("supports future one-time reminders and daily rollover helper", () => {
    const now = DateTime.fromISO("2026-04-13T08:00:00", { zone: "Asia/Seoul" });
    expect(nextReminderRunAt({ recurrence: "once", time: "13:00", timezone: "Asia/Seoul" }, now)).toBe(
      "2026-04-13T04:00:00.000Z",
    );
    expect(
      nextReminderRunAt(
        { recurrence: "once", date: "2026-04-14", time: "13:00", timezone: "Asia/Seoul" },
        now,
      ),
    ).toBe("2026-04-14T04:00:00.000Z");
    expect(nextDailyRunAt({ scheduledTime: "09:00", timezone: "Asia/Seoul" }, now)).toBe(
      "2026-04-13T00:00:00.000Z",
    );
  });

  it("describes reminders and builds retry timestamps", () => {
    expect(
      describeReminder({ recurrence: "daily", nextRunAt: "2026-04-13T00:00:00.000Z", timezone: "Asia/Seoul" }),
    ).toBe("every day 09:00 (Asia/Seoul)");
    expect(
      describeReminder({ recurrence: "once", nextRunAt: "2026-04-14T04:00:00.000Z", timezone: "Asia/Seoul" }),
    ).toBe("2026-04-14 13:00 (Asia/Seoul)");
    expect(retryReminderRunAt(DateTime.fromISO("2026-04-13T00:00:00Z"))).toBe("2026-04-13T00:05:00.000Z");
  });

  it("rejects invalid reminder inputs", () => {
    const now = DateTime.fromISO("2026-04-13T08:00:00", { zone: "Asia/Seoul" });

    expect(() =>
      nextReminderRunAt({ recurrence: "once", time: "9:00", timezone: "Asia/Seoul" }, now),
    ).toThrow("Invalid time");
    expect(() =>
      nextReminderRunAt({ recurrence: "once", date: "2026/04/14", time: "09:00", timezone: "Asia/Seoul" }, now),
    ).toThrow("Invalid date");
    expect(() =>
      nextReminderRunAt({ recurrence: "once", time: "09:00", timezone: "Mars/Phobos" }, now),
    ).toThrow("Invalid timezone");
    expect(() =>
      nextReminderRunAt({ recurrence: "once", date: "2026-02-30", time: "09:00", timezone: "Asia/Seoul" }, now),
    ).toThrow("Invalid date/time");
    expect(() =>
      nextReminderRunAt({ recurrence: "once", date: "2026-04-13", time: "07:00", timezone: "Asia/Seoul" }, now),
    ).toThrow("Scheduled time must be in future");
    expect(() => retryReminderRunAt(DateTime.invalid("bad timestamp"))).toThrow(
      "Failed to serialize reminder time",
    );
  });
});
