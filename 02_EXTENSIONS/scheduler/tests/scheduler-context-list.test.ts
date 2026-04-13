import { afterEach, describe, expect, it } from "vitest";

import { executeSchedulerAction } from "../src/scheduler.js";
import {
  cleanupSchedulerTempRoots,
  runScheduler,
  schedulerReminder,
} from "./scheduler-test-helpers.js";

afterEach(cleanupSchedulerTempRoots);

describe("scheduler context and list", () => {
  it("fails when discord session context is unavailable", async () => {
    const { result } = await runScheduler({ action: "list" }, [], { sessionFile: "/tmp/missing-session.jsonl" });
    expect(result.details.error).toBe("Discord session context unavailable.");
  });

  it("fails fast when session file is missing", async () => {
    const result = await executeSchedulerAction(
      { action: "list" },
      { cwd: "/repo" },
      { getSessionContextFn: () => { throw new Error("should not read session context"); } },
    );
    expect(result.details.error).toBe("Discord session context unavailable.");
  });

  it("lists only current scope reminders in time order", async () => {
    const { result } = await runScheduler(
      { action: "list" },
      [
        schedulerReminder({ id: "later", nextRunAt: "2026-04-14T00:00:00.000Z" }),
        schedulerReminder({ id: "other", scopeId: "scope:2" }),
        schedulerReminder({ id: "sooner" }),
      ],
    );
    expect(result.content[0]?.text).toBe(
      "- sooner: 2026-04-13 09:00 (Asia/Seoul) -> wake up\n- later: 2026-04-14 09:00 (Asia/Seoul) -> wake up",
    );
  });

  it("returns empty list response when no reminders exist", async () => {
    const { result } = await runScheduler({ action: "list" }, []);
    expect(result.content[0]?.text).toBe("No reminders scheduled.");
  });
});
