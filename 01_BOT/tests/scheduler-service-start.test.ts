import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createSchedulerService } from "../src/features/scheduler/scheduler-service.js";
import {
  cleanupSchedulerServiceTempRoots,
  schedulerServiceClient,
} from "./scheduler-service-test-helpers.js";

const { sendDiscordMessage, runTask } = vi.hoisted(() => ({
  sendDiscordMessage: vi.fn(async () => "sent"),
  runTask: vi.fn(async () => "generated reply"),
}));
vi.mock("../src/integrations/discord/tools/discord-admin-channel.js", () => ({ sendDiscordMessage }));

afterEach(async () => {
  vi.useRealTimers();
  await cleanupSchedulerServiceTempRoots();
});

beforeEach(() => {
  sendDiscordMessage.mockReset();
  sendDiscordMessage.mockResolvedValue("sent");
  runTask.mockReset();
  runTask.mockResolvedValue("generated reply");
});

describe("scheduler service start", () => {
  it("starts once and stops once", async () => {
    vi.useFakeTimers();
    const service = createSchedulerService({ client: schedulerServiceClient, tasksFile: "/tmp/scheduled-tasks.json", runTask });

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
