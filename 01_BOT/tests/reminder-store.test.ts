import { mkdtempSync, writeFileSync } from "node:fs";
import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { listScheduledTasks, mutateScheduledTasks } from "../src/features/scheduler/scheduler-store.js";
import type { ScheduledTaskRecord } from "../src/features/scheduler/scheduler-types.js";

const created: string[] = [];
const reminder = (id: string): ScheduledTaskRecord => ({
  id,
  scopeId: "scope:1",
  authorId: "user-1",
  channelId: "channel-1",
  guildId: "guild-1",
  isDirectMessage: false,
  recurrence: "once",
  prompt: `message-${id}`,
  message: `message-${id}`,
  timezone: "Asia/Seoul",
  scheduledTime: "09:00",
  mentionUser: true,
  createdAt: "2026-04-13T00:00:00.000Z",
  nextRunAt: "2026-04-13T00:00:00.000Z",
});

afterEach(async () => {
  await Promise.all(created.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

describe("reminder store", () => {
  it("creates missing store file and parses blank file", async () => {
    const root = mkdtempSync(join(tmpdir(), "reminder-store-"));
    created.push(root);
    const file = join(root, "scheduler", "reminders.json");

    await expect(listScheduledTasks(file)).resolves.toEqual([]);
    writeFileSync(file, "\n", "utf8");
    await expect(listScheduledTasks(file)).resolves.toEqual([]);
  });

  it("serializes concurrent mutations without losing updates", async () => {
    const root = mkdtempSync(join(tmpdir(), "reminder-store-"));
    created.push(root);
    const file = join(root, "scheduler", "reminders.json");

    const first = mutateScheduledTasks(file, async (current) => {
      await new Promise((resolve) => setTimeout(resolve, 25));
      return { reminders: [...current, reminder("one")], result: current.length };
    });
    const second = mutateScheduledTasks(file, async (current) => ({
      reminders: [...current, reminder("two")],
      result: current.length,
    }));

    await expect(first).resolves.toBe(0);
    await expect(second).resolves.toBe(1);
    await expect(listScheduledTasks(file)).resolves.toEqual([reminder("one"), reminder("two")]);
  });
});
