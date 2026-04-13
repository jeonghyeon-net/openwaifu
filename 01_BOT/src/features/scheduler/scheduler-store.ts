import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

import type { ScheduledTaskRecord } from "./scheduler-types.js";

type SchedulerMutationResult<T> = {
  tasks: ScheduledTaskRecord[];
  result: T;
};

type SchedulerStoreState = {
  mutexes: Map<string, { locked: boolean; waiters: Array<() => void> }>;
};

const schedulerStoreStateSymbol = Symbol.for("openwaifu.schedulerStoreState");

const schedulerStoreState = () => {
  const scope = globalThis as typeof globalThis & {
    [schedulerStoreStateSymbol]?: SchedulerStoreState;
  };
  scope[schedulerStoreStateSymbol] ??= { mutexes: new Map() };
  return scope[schedulerStoreStateSymbol];
};

const acquireLock = async (filePath: string) => {
  const state = schedulerStoreState();
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
  const mutex = schedulerStoreState().mutexes.get(filePath)!;
  const waiter = mutex.waiters.shift();
  if (waiter) {
    waiter();
    return;
  }

  schedulerStoreState().mutexes.delete(filePath);
};

const ensureStoreFile = async (filePath: string) => {
  await mkdir(dirname(filePath), { recursive: true });
  try {
    await readFile(filePath, "utf8");
  } catch {
    await writeFile(filePath, "[]\n", "utf8");
  }
};

const parseScheduledTasks = (content: string): ScheduledTaskRecord[] => {
  const trimmed = content.trim();
  if (!trimmed) return [];
  return JSON.parse(trimmed) as ScheduledTaskRecord[];
};

const writeScheduledTasks = async (filePath: string, tasks: ScheduledTaskRecord[]) => {
  const tempPath = `${filePath}.tmp`;
  await writeFile(tempPath, `${JSON.stringify(tasks, null, 2)}\n`, "utf8");
  await rename(tempPath, filePath);
};

export const listScheduledTasks = async (filePath: string) => {
  await ensureStoreFile(filePath);
  return parseScheduledTasks(await readFile(filePath, "utf8"));
};

export const mutateScheduledTasks = async <T>(
  filePath: string,
  mutate: (current: ScheduledTaskRecord[]) => Promise<SchedulerMutationResult<T>> | SchedulerMutationResult<T>,
) => {
  const release = await acquireLock(filePath);
  try {
    const current = await listScheduledTasks(filePath);
    const next = await mutate(current);
    await writeScheduledTasks(filePath, next.tasks);
    return next.result;
  } finally {
    release();
  }
};
