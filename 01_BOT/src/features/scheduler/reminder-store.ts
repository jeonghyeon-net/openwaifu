import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

import type { ReminderRecord } from "./reminder-types.js";

type ReminderMutationResult<T> = {
  reminders: ReminderRecord[];
  result: T;
};

type ReminderStoreState = {
  mutexes: Map<string, { locked: boolean; waiters: Array<() => void> }>;
};

const reminderStoreStateSymbol = Symbol.for("openwaifu.reminderStoreState");

const reminderStoreState = () => {
  const scope = globalThis as typeof globalThis & {
    [reminderStoreStateSymbol]?: ReminderStoreState;
  };
  scope[reminderStoreStateSymbol] ??= { mutexes: new Map() };
  return scope[reminderStoreStateSymbol];
};

const acquireLock = async (filePath: string) => {
  const state = reminderStoreState();
  const mutex = state.mutexes.get(filePath) ?? { locked: false, waiters: [] };
  state.mutexes.set(filePath, mutex);

  if (!mutex.locked) {
    mutex.locked = true;
    return () => releaseLock(filePath);
  }

  await new Promise<void>((resolve) => mutex.waiters.push(resolve));
  return () => releaseLock(filePath);
};

const releaseLock = (filePath: string) => {
  const mutex = reminderStoreState().mutexes.get(filePath)!;
  const waiter = mutex.waiters.shift();
  if (waiter) {
    waiter();
    return;
  }

  reminderStoreState().mutexes.delete(filePath);
};

const ensureStoreFile = async (filePath: string) => {
  await mkdir(dirname(filePath), { recursive: true });
  try {
    await readFile(filePath, "utf8");
  } catch {
    await writeFile(filePath, "[]\n", "utf8");
  }
};

const parseReminders = (content: string): ReminderRecord[] => {
  const trimmed = content.trim();
  if (!trimmed) return [];
  return JSON.parse(trimmed) as ReminderRecord[];
};

const writeReminders = async (filePath: string, reminders: ReminderRecord[]) => {
  const tempPath = `${filePath}.tmp`;
  await writeFile(tempPath, `${JSON.stringify(reminders, null, 2)}\n`, "utf8");
  await rename(tempPath, filePath);
};

export const listReminders = async (filePath: string) => {
  await ensureStoreFile(filePath);
  return parseReminders(await readFile(filePath, "utf8"));
};

export const mutateReminders = async <T>(
  filePath: string,
  mutate: (current: ReminderRecord[]) => Promise<ReminderMutationResult<T>> | ReminderMutationResult<T>,
) => {
  const release = await acquireLock(filePath);
  try {
    const current = await listReminders(filePath);
    const next = await mutate(current);
    await writeReminders(filePath, next.reminders);
    return next.result;
  } finally {
    release();
  }
};
