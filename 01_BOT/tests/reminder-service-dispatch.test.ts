import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { listReminders, mutateReminders } from "../src/features/scheduler/reminder-store.js";
import { createReminderService } from "../src/features/scheduler/reminder-service.js";
import {
  cleanupReminderServiceTempRoots,
  reminder,
  reminderServiceClient,
  reminderServiceTempRoots,
} from "./reminder-service-test-helpers.js";

const { sendDiscordMessage } = vi.hoisted(() => ({
  sendDiscordMessage: vi.fn(async () => "sent"),
}));
vi.mock("../src/integrations/discord/tools/discord-admin-channel.js", () => ({ sendDiscordMessage }));

afterEach(cleanupReminderServiceTempRoots);
beforeEach(() => {
  sendDiscordMessage.mockReset();
  sendDiscordMessage.mockResolvedValue("sent");
});

describe("reminder service dispatch", () => {
  it("dispatches due reminders and reschedules daily reminders", async () => {
    const root = mkdtempSync(join(tmpdir(), "reminder-service-"));
    reminderServiceTempRoots.push(root);
    const file = join(root, "reminders.json");
    await mutateReminders(file, async () => ({
      reminders: [
        reminder({ id: "once-dm", isDirectMessage: true, guildId: undefined, mentionUser: true }),
        reminder({ id: "daily-guild", recurrence: "daily" }),
        reminder({ id: "once-no-mention", mentionUser: false }),
        reminder({ id: "future", nextRunAt: "2026-04-14T00:00:00.000Z" }),
      ],
      result: undefined,
    }));

    await createReminderService({
      client: reminderServiceClient,
      remindersFile: file,
      now: () => new Date("2026-04-13T00:01:00.000Z"),
    }).dispatchDue();

    expect(sendDiscordMessage).toHaveBeenNthCalledWith(1, reminderServiceClient, expect.objectContaining({ id: "once-dm" }), { channelId: "channel-1", content: "wake up" });
    expect(sendDiscordMessage).toHaveBeenNthCalledWith(2, reminderServiceClient, expect.objectContaining({ id: "daily-guild" }), { channelId: "channel-1", content: "<@user-1> wake up" });
    expect(sendDiscordMessage).toHaveBeenNthCalledWith(3, reminderServiceClient, expect.objectContaining({ id: "once-no-mention" }), { channelId: "channel-1", content: "wake up" });
    await expect(listReminders(file)).resolves.toEqual([
      expect.objectContaining({ id: "daily-guild", lastTriggeredAt: "2026-04-13T00:01:00.000Z", nextRunAt: "2026-04-14T00:00:00.000Z" }),
      expect.objectContaining({ id: "future" }),
    ]);
  });
});
