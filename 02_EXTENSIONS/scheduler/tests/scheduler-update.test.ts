import { afterEach, describe, expect, it } from "vitest";
import { DateTime } from "luxon";

import { executeSchedulerAction } from "../src/scheduler.js";
import {
  cleanupSchedulerTempRoots,
  runScheduler,
  schedulerSessionContext,
  schedulerTask,
} from "./scheduler-test-helpers.js";

afterEach(cleanupSchedulerTempRoots);

describe("scheduler update", () => {
  it("validates update arguments and handles missing tasks", async () => {
    expect((await runScheduler({ action: "update", prompt: "fix" }, [])).result.details.error).toBe("id required for update.");
    expect((await runScheduler({ action: "update", id: "task-1" }, [schedulerTask({ id: "task-1" })])).result.details.error).toBe("provide at least one field to update.");
    expect((await runScheduler({ action: "update", id: "task-1", prompt: "" }, [schedulerTask({ id: "task-1" })])).result.details.error).toBe("prompt cannot be empty for update.");
    expect((await runScheduler({ action: "update", id: "task-1", cron: "0 9 * * *", time: "09:00" }, [schedulerTask({ id: "task-1" })])).result.details.error).toContain("use cron for recurring schedules");
    expect((await runScheduler({ action: "update", id: "missing", prompt: "fix" }, [schedulerTask({ id: "task-1" })])).result.details.error).toBe("Scheduled task not found: missing");
  });

  it("updates prompt and mention without changing schedule", async () => {
    const { result, stored } = await runScheduler(
      { action: "update", id: "task-1", prompt: "new prompt", mentionUser: false },
      [
        schedulerTask({ id: "task-1", prompt: "old prompt", nextRunAt: "2026-04-13T00:00:00.000Z" }),
        schedulerTask({ id: "task-2", nextRunAt: "2026-04-14T00:00:00.000Z" }),
      ],
    );
    expect(result.details.updated).toEqual(expect.objectContaining({ id: "task-1", prompt: "new prompt", mentionUser: false, nextRunAt: "2026-04-13T00:00:00.000Z" }));
    expect(stored).toEqual([
      expect.objectContaining({ id: "task-1", prompt: "new prompt", mentionUser: false }),
      expect.objectContaining({ id: "task-2", prompt: "wake up", mentionUser: true }),
    ]);
  });

  it("switches one-time task to cron schedule and one-time date updates keep existing time", async () => {
    const now = DateTime.fromISO("2026-04-13T08:00:00", { zone: "Asia/Seoul" });
    const cronUpdate = await runScheduler(
      { action: "update", id: "task-1", cron: "30 10 * * 1-5" },
      [schedulerTask({ id: "task-1", recurrence: "once", scheduledTime: "09:00", scheduledDate: "2026-04-13" })],
      { deps: { now: () => now } },
    );
    expect(cronUpdate.result.details.updated).toEqual(expect.objectContaining({ recurrence: "cron", cron: "30 10 * * 1-5", scheduledTime: undefined, scheduledDate: undefined, nextRunAt: "2026-04-13T01:30:00.000Z" }));

    const dateUpdate = await runScheduler(
      { action: "update", id: "task-1", date: "2026-04-15" },
      [schedulerTask({ id: "task-1", recurrence: "once", scheduledTime: "09:00", scheduledDate: "2026-04-14", nextRunAt: "2026-04-14T00:00:00.000Z" })],
      { deps: { now: () => now } },
    );
    expect(dateUpdate.result.details.updated).toEqual(expect.objectContaining({ recurrence: "once", cron: undefined, scheduledTime: "09:00", scheduledDate: "2026-04-15", nextRunAt: "2026-04-15T00:00:00.000Z" }));
  });

  it("switches cron task to one-time schedule when time is provided", async () => {
    const { result } = await runScheduler(
      { action: "update", id: "task-1", time: "11:45" },
      [schedulerTask({ id: "task-1", recurrence: "cron", cron: "0 9 * * *", scheduledTime: undefined, scheduledDate: undefined, nextRunAt: "2026-04-14T00:00:00.000Z" })],
      { deps: { now: () => DateTime.fromISO("2026-04-13T08:00:00", { zone: "Asia/Seoul" }) } },
    );
    expect(result.details.updated).toEqual(expect.objectContaining({ recurrence: "once", cron: undefined, scheduledTime: "11:45", scheduledDate: undefined, nextRunAt: "2026-04-13T02:45:00.000Z" }));
  });

  it("reports schedule-update failures and stringifies thrown values", async () => {
    const badDate = await runScheduler(
      { action: "update", id: "task-1", date: "2026-04-15" },
      [schedulerTask({ id: "task-1", recurrence: "cron", cron: "0 9 * * *", scheduledTime: undefined, scheduledDate: undefined })],
      { deps: { now: () => DateTime.fromISO("2026-04-13T08:00:00", { zone: "Asia/Seoul" }) } },
    );
    expect(badDate.result.details.error).toBe("time required when updating one-time schedule.");

    const failed = await executeSchedulerAction(
      { action: "update", id: "task-1", prompt: "fail" },
      { cwd: "/repo", sessionFile: "/tmp/session.jsonl" },
      {
        getSessionContextFn: () => schedulerSessionContext,
        listScheduledTasksFn: async () => [schedulerTask({ id: "task-1" })],
        mutateScheduledTasksFn: async () => { throw "boom"; },
      },
    );
    expect(failed.details.error).toBe("boom");
  });
});
