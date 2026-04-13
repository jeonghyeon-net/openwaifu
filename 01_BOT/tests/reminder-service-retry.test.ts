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

describe("reminder service retry", () => {
  it("retries failed reminders and ignores overlapping dispatch", async () => {
    const root = mkdtempSync(join(tmpdir(), "reminder-service-"));
    schedulerServiceTempRoots.push(root);
    const file = join(root, "reminders.json");
    const seed = async () => mutateScheduledTasks(file, async () => ({ reminders: [reminder({ id: "retry" })], result: undefined }));
    await seed();

    let release: () => void = () => {};
    let notifyStarted: () => void = () => {};
    const started = new Promise<void>((resolve) => { notifyStarted = () => resolve(); });
    sendDiscordMessage.mockImplementationOnce(() => new Promise((resolve) => {
      notifyStarted();
      release = () => { resolve("sent"); };
    }));

    const logger = { error: vi.fn() };
    const service = createSchedulerService({ client: schedulerServiceClient, tasksFile: file, now: () => new Date("2026-04-13T00:00:00.000Z"), logger, runTask });
    const first = service.dispatchDue();
    await started;
    const second = service.dispatchDue();
    release();
    await first;
    await second;
    expect(sendDiscordMessage).toHaveBeenCalledTimes(1);

    await seed();
    runTask.mockRejectedValueOnce(new Error("boom"));
    await service.dispatchDue();
    await seed();
    runTask.mockRejectedValueOnce("plain failure");
    await service.dispatchDue();

    expect(logger.error).toHaveBeenCalledWith("Failed to dispatch scheduled task retry: boom");
    expect(logger.error).toHaveBeenCalledWith("Failed to dispatch scheduled task retry: plain failure");
    await expect(listScheduledTasks(file)).resolves.toEqual([expect.objectContaining({ id: "retry", nextRunAt: "2026-04-13T00:05:00.000Z" })]);
  });
});
