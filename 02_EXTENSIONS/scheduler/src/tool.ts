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
    prepareArguments: (args): SchedulerToolInput => {
      if (!args || typeof args !== "object") return args as SchedulerToolInput;
      const input = args as Partial<SchedulerToolInput> & { message?: unknown; recurrence?: unknown };
      const prompt = typeof input.prompt === "string"
        ? input.prompt
        : typeof input.message === "string"
          ? input.message
          : undefined;
      const cron = typeof input.cron === "string"
        ? input.cron
        : input.recurrence === "daily" && typeof input.time === "string"
          ? `${input.time.slice(3, 5)} ${input.time.slice(0, 2)} * * *`
          : undefined;
      return {
        action: input.action ?? "list",
        ...(typeof input.time === "string" ? { time: input.time } : {}),
        ...(typeof input.date === "string" ? { date: input.date } : {}),
        ...(typeof cron === "string" ? { cron } : {}),
        ...(typeof prompt === "string" ? { prompt } : {}),
        ...(typeof input.id === "string" ? { id: input.id } : {}),
        ...(typeof input.mentionUser === "boolean" ? { mentionUser: input.mentionUser } : {}),
      };
    },
    execute: async (_toolCallId, params: SchedulerToolInput, _signal, _onUpdate, ctx) =>
      executeSchedulerAction(params, {
        cwd: ctx.cwd,
        sessionFile: ctx.sessionManager.getSessionFile(),
      }),
  }) satisfies ToolDefinition<typeof schedulerToolParameters>;
