import { DateTime } from "luxon";

import type { DiscordAdminClient } from "../../integrations/discord/tools/discord-admin-types.js";
import { sendDiscordMessage } from "../../integrations/discord/tools/discord-admin-channel.js";
import { mutateReminders } from "./reminder-store.js";
import { nextDailyRunAt, retryReminderRunAt } from "./reminder-time.js";
import type { ReminderRecord } from "./reminder-types.js";

type ReminderServiceOptions = {
  client: DiscordAdminClient;
  remindersFile: string;
  pollMs?: number;
  now?: () => Date;
  logger?: Pick<Console, "error">;
  setIntervalFn?: typeof setInterval;
  clearIntervalFn?: typeof clearInterval;
};

const reminderContent = (reminder: ReminderRecord) =>
  reminder.isDirectMessage || !reminder.mentionUser
    ? reminder.message
    : `<@${reminder.authorId}> ${reminder.message}`;

export class ReminderService {
  private readonly pollMs: number;
  private readonly logger: Pick<Console, "error">;
  private readonly setIntervalFn: typeof setInterval;
  private readonly clearIntervalFn: typeof clearInterval;
  private interval?: ReturnType<typeof setInterval>;
  private running = false;

  constructor(private readonly options: ReminderServiceOptions) {
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

      await mutateReminders(this.options.remindersFile, async (current) => {
        const reminders: ReminderRecord[] = [];
        for (const reminder of current) {
          if (Date.parse(reminder.nextRunAt) > nowMs) {
            reminders.push(reminder);
            continue;
          }
          try {
            await sendDiscordMessage(this.options.client, reminder, {
              channelId: reminder.channelId,
              content: reminderContent(reminder),
            });
            if (reminder.recurrence === "daily") {
              reminders.push({ ...reminder, lastTriggeredAt: now.toISOString(), nextRunAt: nextDailyRunAt(reminder, nowTime) });
            }
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.logger.error(`Failed to dispatch reminder ${reminder.id}: ${message}`);
            reminders.push({ ...reminder, nextRunAt: retryReminderRunAt(nowTime) });
          }
        }
        return { reminders, result: undefined };
      });
    } finally {
      this.running = false;
    }
  }
}

export const createReminderService = (options: ReminderServiceOptions) => new ReminderService(options);
