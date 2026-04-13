import { join } from "node:path";

export const remindersDirectoryForCwd = (cwd: string) =>
  join(cwd, "01_BOT", ".data", "scheduler");

export const remindersFileForCwd = (cwd: string) =>
  join(remindersDirectoryForCwd(cwd), "reminders.json");
