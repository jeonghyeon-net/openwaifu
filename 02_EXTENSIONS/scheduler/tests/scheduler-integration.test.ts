import { mkdtempSync } from "node:fs";
import { afterEach, describe, expect, it } from "vitest";
import { DateTime } from "luxon";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { listReminders } from "../../../01_BOT/src/features/scheduler/reminder-store.js";
import { registerDiscordSessionContext } from "../../../01_BOT/src/integrations/pi/discord-session-context.js";
import { executeSchedulerAction } from "../src/scheduler.js";
import {
  cleanupSchedulerTempRoots,
  schedulerTempRoots,
} from "./scheduler-test-helpers.js";

afterEach(cleanupSchedulerTempRoots);

describe("scheduler integration", () => {
  it("keeps reminders fixed to Korea time even if caller wants another timezone", async () => {
    const added = await executeSchedulerAction(
      { action: "add", recurrence: "daily", time: "09:00", mentionUser: false, message: "daily standup" },
      { cwd: "/repo", sessionFile: "/tmp/session.jsonl" },
      {
        now: () => DateTime.fromISO("2026-04-13T08:00:00", { zone: "America/New_York" }),
        createId: () => "new-id",
        getSessionContextFn: () => ({ scopeId: "scope:1", discordContext: { authorId: "user-1", channelId: "channel-1", guildId: "guild-1", isDirectMessage: false } }),
        listRemindersFn: async () => [],
        mutateRemindersFn: async (_file, mutate) => (await mutate([])).result,
      },
    );
    expect(added.details.created).toEqual(expect.objectContaining({ mentionUser: false, timezone: "Asia/Seoul" }));
  });

  it("uses default store, session registry, generated ids, and fixed Korea timezone", async () => {
    const cwd = mkdtempSync(join(tmpdir(), "scheduler-ext-"));
    schedulerTempRoots.push(cwd);
    registerDiscordSessionContext("/tmp/real-session.jsonl", "scope:env", {
      authorId: "user-env",
      channelId: "channel-env",
      guildId: undefined,
      isDirectMessage: true,
    });

    const originalNow = DateTime.now;
    DateTime.now = () => DateTime.fromISO("2026-04-13T08:00:00", { zone: "Asia/Seoul" }) as DateTime<true>;
    try {
      const result = await executeSchedulerAction(
        { action: "add", recurrence: "once", date: "2099-01-01", time: "13:00", message: "env reminder" },
        { cwd, sessionFile: "/tmp/real-session.jsonl" },
      );
      expect(result.details.created).toEqual(expect.objectContaining({ timezone: "Asia/Seoul", isDirectMessage: true }));
      expect(result.details.created?.id).toHaveLength(8);
      await expect(listReminders(join(cwd, "01_BOT/.data/scheduler/reminders.json"))).resolves.toHaveLength(1);
    } finally {
      DateTime.now = originalNow;
    }
  });
});
