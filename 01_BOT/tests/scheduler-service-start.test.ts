import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createSchedulerService } from "../src/features/scheduler/scheduler-service.js";
import { cleanupSchedulerServiceTempRoots } from "./scheduler-service-test-helpers.js";

const { runTask } = vi.hoisted(() => ({
  runTask: vi.fn(async () => undefined),
}));

afterEach(async () => {
  vi.useRealTimers();
  await cleanupSchedulerServiceTempRoots();
});

beforeEach(() => {
  runTask.mockReset();
  runTask.mockResolvedValue(undefined);
});

describe("scheduler service start", () => {
  it("starts once and stops once", async () => {
    vi.useFakeTimers();
    const service = createSchedulerService({ tasksFile: "/tmp/scheduled-tasks.json", runTask });

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
