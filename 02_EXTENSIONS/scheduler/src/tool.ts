import { defineTool } from "@mariozechner/pi-coding-agent";

import {
  schedulerToolDescription,
  schedulerToolGuidelines,
  schedulerToolPromptSnippet,
} from "./metadata.js";
import { schedulerToolParameters } from "./schema.js";
import { executeSchedulerAction } from "./execute.js";

export const createSchedulerTool = () =>
  defineTool({
    name: "scheduler_reminder",
    label: "Scheduler Reminder",
    description: schedulerToolDescription,
    promptSnippet: schedulerToolPromptSnippet,
    promptGuidelines: schedulerToolGuidelines,
    parameters: schedulerToolParameters,
    execute: async (_toolCallId, params, _signal, _onUpdate, ctx) =>
      executeSchedulerAction(params, {
        cwd: ctx.cwd,
        sessionFile: ctx.sessionManager.getSessionFile(),
      }),
  });
