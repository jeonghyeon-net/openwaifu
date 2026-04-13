import { DateTime } from "luxon";

import { mutateScheduledTasks } from "./scheduler-store.js";
import { nextCronRunAt, retryScheduledRunAt } from "./scheduler-time.js";
import type { ScheduledTaskRecord } from "./scheduler-types.js";

type SchedulerServiceOptions = {
  tasksFile: string;
  runTask: (scheduledTask: ScheduledTaskRecord) => Promise<void>;
  pollMs?: number;
  now?: () => Date;
  logger?: Pick<Console, "error">;
  setIntervalFn?: typeof setInterval;
  clearIntervalFn?: typeof clearInterval;
};

export class SchedulerService {
  private readonly pollMs: number;
  private readonly logger: Pick<Console, "error">;
  private readonly setIntervalFn: typeof setInterval;
  private readonly clearIntervalFn: typeof clearInterval;
  private interval?: ReturnType<typeof setInterval>;
  private running = false;

  constructor(private readonly options: SchedulerServiceOptions) {
    this.pollMs = options.pollMs ?? 5_000;
    this.logger = options.logger ?? console;
    this.setIntervalFn = options.setIntervalFn ?? setInterval;
    this.clearIntervalFn = options.clearIntervalFn ?? clearInterval;
  }

  start() {
    if (this.interval) return;
    this.interval = this.setIntervalFn(() => void this.dispatchDue(), this.pollMs);
    void this.dispatchDue();
  }

  stop() {
    if (!this.interval) return;
    this.clearIntervalFn(this.interval);
    this.interval = undefined;
  }

  async dispatchDue() {
    if (this.running) return;
    this.running = true;

    try {
      const now = this.options.now?.() ?? new Date();
      const nowMs = now.getTime();
      const nowTime = DateTime.fromJSDate(now);

      await mutateScheduledTasks(this.options.tasksFile, async (current) => {
        const tasks: ScheduledTaskRecord[] = [];
        for (const scheduledTask of current) {
          if (Date.parse(scheduledTask.nextRunAt) > nowMs) {
            tasks.push(scheduledTask);
            continue;
          }
          try {
            await this.options.runTask(scheduledTask);
            if (scheduledTask.recurrence === "cron") {
              tasks.push({
                ...scheduledTask,
                lastTriggeredAt: now.toISOString(),
                nextRunAt: nextCronRunAt(scheduledTask, nowTime),
              });
            }
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.logger.error(`Failed to dispatch scheduled task ${scheduledTask.id}: ${message}`);
            tasks.push({ ...scheduledTask, nextRunAt: retryScheduledRunAt(nowTime) });
          }
        }
        return { tasks, result: undefined };
      });
    } finally {
      this.running = false;
    }
  }
}

export const createSchedulerService = (options: SchedulerServiceOptions) => new SchedulerService(options);
