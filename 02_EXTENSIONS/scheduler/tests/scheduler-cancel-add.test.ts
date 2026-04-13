import { afterEach, describe, expect, it } from "vitest";
import { DateTime } from "luxon";

import { executeSchedulerAction } from "../src/scheduler.js";
import {
  cleanupSchedulerTempRoots,
  runScheduler,
  schedulerTask,
  schedulerSessionContext,
} from "./scheduler-test-helpers.js";

afterEach(cleanupSchedulerTempRoots);

describe("scheduler cancel and add", () => {
  it("validates cancel arguments and handles missing ids", async () => {
    const missingId = await runScheduler({ action: "cancel" }, [schedulerTask({ id: "keep" })]);
    expect(missingId.result.details.error).toBe("id required for cancel.");
    const notFound = await runScheduler({ action: "cancel", id: "missing" }, [schedulerTask({ id: "keep" })]);
    expect(notFound.result.details.error).toBe("Scheduled task not found: missing");
  });

  it("cancels scoped scheduled tasks", async () => {
    const { result, stored } = await runScheduler(
      { action: "cancel", id: "drop" },
      [schedulerTask({ id: "drop" }), schedulerTask({ id: "keep" }), schedulerTask({ id: "other", scopeId: "scope:2" })],
    );
    expect(result.details.removedId).toBe("drop");
    expect(stored).toEqual([schedulerTask({ id: "keep" }), schedulerTask({ id: "other", scopeId: "scope:2" })]);
  });

  it("validates add arguments and schedule parsing errors", async () => {
    expect((await runScheduler({ action: "add" }, [])).result.details.error).toBe("prompt and either cron or time required for add.");
    const badTime = await runScheduler(
      { action: "add", time: "9:00", prompt: "wake up" },
      [],
      { deps: { now: () => DateTime.fromISO("2026-04-13T08:00:00", { zone: "Asia/Seoul" }) } },
    );
    expect(badTime.result.details.error).toContain("Invalid time");
    const mixed = await runScheduler(
      { action: "add", time: "09:00", cron: "0 9 * * *", prompt: "wake up" },
      [],
    );
    expect(mixed.result.details.error).toContain("use cron for recurring schedules");
  });

  it("adds scheduled tasks and stringifies non-Error failures", async () => {
    const added = await runScheduler(
      { action: "add", time: "13:00", prompt: "lunch" },
      [],
      { deps: { now: () => DateTime.fromISO("2026-04-13T08:00:00", { zone: "Asia/Seoul" }) } },
    );
    expect(added.result.details.created).toEqual(expect.objectContaining({ id: "new-id", mentionUser: true, recurrence: "once" }));
    const failed = await executeSchedulerAction(
      { action: "add", cron: "0 9 * * *", prompt: "fail" },
      { cwd: "/repo", sessionFile: "/tmp/session.jsonl" },
      {
        now: () => DateTime.fromISO("2026-04-13T08:00:00", { zone: "Asia/Seoul" }),
        getSessionContextFn: () => schedulerSessionContext,
        listScheduledTasksFn: async () => added.result.details.tasks,
        mutateScheduledTasksFn: async () => { throw "boom"; },
      },
    );
    expect(failed.details.error).toBe("boom");
  });
});
