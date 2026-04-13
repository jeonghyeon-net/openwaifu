import { describeScheduledTask } from "../../../01_BOT/src/features/scheduler/scheduler-time.js";
import type { ScheduledTaskRecord } from "../../../01_BOT/src/features/scheduler/scheduler-types.js";

import { response } from "./helpers.js";

const scheduledTaskPrompt = (scheduledTask: ScheduledTaskRecord) =>
  scheduledTask.prompt;

export const listScheduledTaskAction = (tasks: ScheduledTaskRecord[]) => {
  if (tasks.length === 0) return response("list", [], "No scheduled tasks.");
  const lines = tasks.map(
    (scheduledTask) => `- ${scheduledTask.id}: ${describeScheduledTask(scheduledTask)} -> ${scheduledTaskPrompt(scheduledTask)}`,
  );
  return response("list", tasks, lines.join("\n"));
};
