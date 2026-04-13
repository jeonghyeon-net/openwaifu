import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { listScheduledTasks, mutateScheduledTasks } from "../src/features/scheduler/scheduler-store.js";
import { createSchedulerService } from "../src/features/scheduler/scheduler-service.js";
import {
  cleanupSchedulerServiceTempRoots,
  reminder,
  schedulerServiceClient,
  schedulerServiceTempRoots,
} from "./reminder-service-test-helpers.js";

const { sendDiscordMessage, runTask } = vi.hoisted(() => ({
  sendDiscordMessage: vi.fn(async () => "sent"),
  runTask: vi.fn(async () => "generated reply"),
}));
vi.mock("../src/integrations/discord/tools/discord-admin-channel.js", () => ({ sendDiscordMessage }));

afterEach(cleanupSchedulerServiceTempRoots);
beforeEach(() => {
  sendDiscordMessage.mockReset();
  sendDiscordMessage.mockResolvedValue("sent");
  runTask.mockReset();
  runTask.mockResolvedValue("generated reply");
});

describe("reminder service dispatch", () => {
  it("dispatches due reminders and reschedules daily reminders", async () => {
    const root = mkdtempSync(join(tmpdir(), "reminder-service-"));
    schedulerServiceTempRoots.push(root);
    const file = join(root, "reminders.json");
    await mutateScheduledTasks(file, async () => ({
      reminders: [
        reminder({ id: "once-dm", isDirectMessage: true, guildId: undefined, mentionUser: true }),
        reminder({ id: "daily-guild", recurrence: "daily" }),
        reminder({ id: "once-no-mention", mentionUser: false }),
        reminder({ id: "future", nextRunAt: "2026-04-14T00:00:00.000Z" }),
      ],
      result: undefined,
    }));

    await createSchedulerService({
      client: schedulerServiceClient,
      tasksFile: file,
      now: () => new Date("2026-04-13T00:01:00.000Z"),
      runTask,
    }).dispatchDue();

    expect(runTask).toHaveBeenNthCalledWith(1, expect.objectContaining({ id: "once-dm", prompt: "wake up" }));
    expect(runTask).toHaveBeenNthCalledWith(2, expect.objectContaining({ id: "daily-guild", prompt: "wake up" }));
    expect(runTask).toHaveBeenNthCalledWith(3, expect.objectContaining({ id: "once-no-mention", prompt: "wake up" }));
    expect(sendDiscordMessage).toHaveBeenNthCalledWith(1, schedulerServiceClient, expect.objectContaining({ id: "once-dm" }), { channelId: "channel-1", content: "generated reply" });
    expect(sendDiscordMessage).toHaveBeenNthCalledWith(2, schedulerServiceClient, expect.objectContaining({ id: "daily-guild" }), { channelId: "channel-1", content: "<@user-1> generated reply" });
    expect(sendDiscordMessage).toHaveBeenNthCalledWith(3, schedulerServiceClient, expect.objectContaining({ id: "once-no-mention" }), { channelId: "channel-1", content: "generated reply" });
    await expect(listScheduledTasks(file)).resolves.toEqual([
      expect.objectContaining({ id: "daily-guild", lastTriggeredAt: "2026-04-13T00:01:00.000Z", nextRunAt: "2026-04-14T00:00:00.000Z" }),
      expect.objectContaining({ id: "future" }),
    ]);
  });
});
