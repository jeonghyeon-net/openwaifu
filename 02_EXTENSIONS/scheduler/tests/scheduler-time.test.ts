import { describe, expect, it } from "vitest";
import { DateTime } from "luxon";

import { describeScheduledTask, nextScheduledRunAt } from "../src/scheduler-time.js";

describe("extension scheduler time", () => {
  const now = DateTime.fromISO("2026-04-13T08:00:00", { zone: "Asia/Seoul" });

  it("builds one-time and cron timestamps", () => {
    expect(nextScheduledRunAt({ time: "09:00", timezone: "Asia/Seoul" }, now)).toBe("2026-04-13T00:00:00.000Z");
    expect(nextScheduledRunAt({ time: "07:00", timezone: "Asia/Seoul" }, now)).toBe("2026-04-13T22:00:00.000Z");
    expect(nextScheduledRunAt({ date: "2026-04-15", time: "13:00", timezone: "Asia/Seoul" }, now)).toBe("2026-04-15T04:00:00.000Z");
    expect(nextScheduledRunAt({ cron: "0 9 * * *", timezone: "Asia/Seoul" }, now)).toBe("2026-04-13T00:00:00.000Z");
  });

  it("describes scheduled tasks", () => {
    expect(describeScheduledTask({ recurrence: "cron", cron: "0 9 * * *", nextRunAt: "2026-04-14T00:00:00.000Z", timezone: "Asia/Seoul" })).toBe("cron 0 9 * * * (next 2026-04-14 09:00 Asia/Seoul)");
    expect(describeScheduledTask({ recurrence: "once", nextRunAt: "2026-04-14T04:00:00.000Z", timezone: "Asia/Seoul" })).toBe("2026-04-14 13:00 (Asia/Seoul)");
  });

  it("rejects invalid scheduler inputs", () => {
    expect(() => nextScheduledRunAt({ timezone: "Asia/Seoul" }, now)).toThrow("Time required when cron is not set");
    expect(() => nextScheduledRunAt({ time: "9:00", timezone: "Asia/Seoul" }, now)).toThrow("Invalid time");
    expect(() => nextScheduledRunAt({ date: "2026/04/15", time: "09:00", timezone: "Asia/Seoul" }, now)).toThrow("Invalid date");
    expect(() => nextScheduledRunAt({ time: "09:00", timezone: "Mars/Phobos" }, now)).toThrow("Invalid timezone");
    expect(() => nextScheduledRunAt({ date: "2026-02-30", time: "09:00", timezone: "Asia/Seoul" }, now)).toThrow("Invalid date/time");
    expect(() => nextScheduledRunAt({ date: "2026-04-13", time: "07:00", timezone: "Asia/Seoul" }, now)).toThrow("Scheduled time must be in future");
    expect(() => nextScheduledRunAt({ time: "09:00", timezone: "UTC" }, DateTime.invalid("bad"))).toThrow("Failed to serialize scheduled task time");
  });
});
