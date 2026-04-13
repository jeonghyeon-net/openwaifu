import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createReminderService } from "../src/features/scheduler/reminder-service.js";
import {
  cleanupReminderServiceTempRoots,
  reminderServiceClient,
} from "./reminder-service-test-helpers.js";

const { sendDiscordMessage } = vi.hoisted(() => ({
  sendDiscordMessage: vi.fn(async () => "sent"),
}));
vi.mock("../src/integrations/discord/tools/discord-admin-channel.js", () => ({ sendDiscordMessage }));

afterEach(async () => {
  vi.useRealTimers();
  await cleanupReminderServiceTempRoots();
});

beforeEach(() => {
  sendDiscordMessage.mockReset();
  sendDiscordMessage.mockResolvedValue("sent");
});

describe("reminder service start", () => {
  it("starts once and stops once", async () => {
    vi.useFakeTimers();
    const service = createReminderService({ client: reminderServiceClient, remindersFile: "/tmp/reminders.json" });

    service.start();
    await vi.advanceTimersByTimeAsync(5_000);
    service.start();
    expect(vi.getTimerCount()).toBe(1);

    service.stop();
    expect(vi.getTimerCount()).toBe(0);
    service.stop();
    expect(vi.getTimerCount()).toBe(0);
  });
});
