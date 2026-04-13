import { join } from "node:path";

export const schedulerDirectoryForCwd = (cwd: string) =>
  join(cwd, "01_BOT", ".data", "scheduler");

export const schedulerFileForCwd = (cwd: string) =>
  join(schedulerDirectoryForCwd(cwd), "scheduled-tasks.json");
