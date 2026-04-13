import type { ToolDefinition } from "@mariozechner/pi-coding-agent";

import {
  schedulerToolDescription,
  schedulerToolGuidelines,
  schedulerToolPromptSnippet,
} from "./metadata.js";
import { schedulerToolParameters, type SchedulerToolInput } from "./schema.js";
import { executeSchedulerAction } from "./execute.js";

export const createSchedulerTool = () =>
  ({
    name: "scheduler",
    label: "Scheduler",
    description: schedulerToolDescription,
    promptSnippet: schedulerToolPromptSnippet,
    promptGuidelines: schedulerToolGuidelines,
    parameters: schedulerToolParameters,
    execute: async (_toolCallId, params: SchedulerToolInput, _signal, _onUpdate, ctx) =>
      executeSchedulerAction(params, {
        cwd: ctx.cwd,
        sessionFile: ctx.sessionManager.getSessionFile(),
      }),
  }) satisfies ToolDefinition<typeof schedulerToolParameters>;
