import { afterEach, describe, expect, it } from "vitest";
import { DateTime } from "luxon";

import { executeSchedulerAction } from "../src/scheduler.js";
import {
  cleanupSchedulerTempRoots,
  runScheduler,
  schedulerReminder,
  schedulerSessionContext,
} from "./scheduler-test-helpers.js";

afterEach(cleanupSchedulerTempRoots);

describe("scheduler cancel and add", () => {
  it("validates cancel arguments and handles missing ids", async () => {
    const missingId = await runScheduler({ action: "cancel" }, [schedulerReminder({ id: "keep" })]);
    expect(missingId.result.details.error).toBe("id required for cancel.");
    const notFound = await runScheduler({ action: "cancel", id: "missing" }, [schedulerReminder({ id: "keep" })]);
    expect(notFound.result.details.error).toBe("Reminder not found: missing");
  });

  it("cancels scoped reminders", async () => {
    const { result, stored } = await runScheduler(
      { action: "cancel", id: "drop" },
      [schedulerReminder({ id: "drop" }), schedulerReminder({ id: "keep" }), schedulerReminder({ id: "other", scopeId: "scope:2" })],
    );
    expect(result.details.removedId).toBe("drop");
    expect(stored).toEqual([schedulerReminder({ id: "keep" }), schedulerReminder({ id: "other", scopeId: "scope:2" })]);
  });

  it("validates add arguments and schedule parsing errors", async () => {
    expect((await runScheduler({ action: "add" }, [])).result.details.error).toBe("recurrence, time, and message required for add.");
    const badTime = await runScheduler(
      { action: "add", recurrence: "once", time: "9:00", message: "wake up" },
      [],
      { deps: { now: () => DateTime.fromISO("2026-04-13T08:00:00", { zone: "Asia/Seoul" }) } },
    );
    expect(badTime.result.details.error).toContain("Invalid time");
  });

  it("adds reminders and stringifies non-Error failures", async () => {
    const added = await runScheduler(
      { action: "add", recurrence: "once", time: "13:00", message: "lunch" },
      [],
      { deps: { now: () => DateTime.fromISO("2026-04-13T08:00:00", { zone: "Asia/Seoul" }) } },
    );
    expect(added.result.details.created).toEqual(expect.objectContaining({ id: "new-id", mentionUser: true }));
    const failed = await executeSchedulerAction(
      { action: "add", recurrence: "once", time: "13:00", message: "fail" },
      { cwd: "/repo", sessionFile: "/tmp/session.jsonl" },
      {
        now: () => DateTime.fromISO("2026-04-13T08:00:00", { zone: "Asia/Seoul" }),
        getSessionContextFn: () => schedulerSessionContext,
        listRemindersFn: async () => added.result.details.reminders,
        mutateRemindersFn: async () => { throw "boom"; },
      },
    );
    expect(failed.details.error).toBe("boom");
  });
});
