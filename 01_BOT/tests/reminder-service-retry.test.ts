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

describe("reminder service retry", () => {
  it("retries failed reminders and ignores overlapping dispatch", async () => {
    const root = mkdtempSync(join(tmpdir(), "reminder-service-"));
    reminderServiceTempRoots.push(root);
    const file = join(root, "reminders.json");
    const seed = async () => mutateReminders(file, async () => ({ reminders: [reminder({ id: "retry" })], result: undefined }));
    await seed();

    let release: () => void = () => {};
    let notifyStarted: () => void = () => {};
    const started = new Promise<void>((resolve) => { notifyStarted = () => resolve(); });
    sendDiscordMessage.mockImplementationOnce(() => new Promise((resolve) => {
      notifyStarted();
      release = () => { resolve("sent"); };
    }));

    const logger = { error: vi.fn() };
    const service = createReminderService({ client: reminderServiceClient, remindersFile: file, now: () => new Date("2026-04-13T00:00:00.000Z"), logger });
    const first = service.dispatchDue();
    await started;
    const second = service.dispatchDue();
    release();
    await first;
    await second;
    expect(sendDiscordMessage).toHaveBeenCalledTimes(1);

    await seed();
    sendDiscordMessage.mockRejectedValueOnce(new Error("boom"));
    await service.dispatchDue();
    await seed();
    sendDiscordMessage.mockRejectedValueOnce("plain failure");
    await service.dispatchDue();

    expect(logger.error).toHaveBeenCalledWith("Failed to dispatch reminder retry: boom");
    expect(logger.error).toHaveBeenCalledWith("Failed to dispatch reminder retry: plain failure");
    await expect(listReminders(file)).resolves.toEqual([expect.objectContaining({ id: "retry", nextRunAt: "2026-04-13T00:05:00.000Z" })]);
  });
});
