import { Type, type Static } from "@sinclair/typebox";

const stringEnum = <T extends readonly string[]>(values: T) =>
  Type.Unsafe<T[number]>({
    type: "string",
    enum: values,
  });

export const schedulerToolParameters = Type.Object({
  action: stringEnum(["add", "list", "update", "cancel"] as const),
  time: Type.Optional(Type.String({ description: "24-hour local time in HH:mm format for one-time schedules. For update, setting time switches task to one-time mode." })),
  date: Type.Optional(Type.String({ description: "Local date in YYYY-MM-DD format for one-time schedules. Optional for add. For update, use with time or with existing one-time task time." })),
  cron: Type.Optional(Type.String({ description: "Cron expression for recurring schedules, e.g. '0 9 * * *' for every day at 09:00 Korea time. For update, setting cron switches task to recurring mode." })),
  prompt: Type.Optional(Type.String({ description: "Full task prompt to run later in a fresh clean pi session" })),
  id: Type.Optional(Type.String({ description: "Scheduled task id to update or cancel" })),
  mentionUser: Type.Optional(Type.Boolean({ description: "Mention requester when posting scheduled result in channel. Defaults to true." })),
});

export type SchedulerToolInput = Static<typeof schedulerToolParameters>;
