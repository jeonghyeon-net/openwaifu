import { Type, type Static } from "@sinclair/typebox";

const stringEnum = <T extends readonly string[]>(values: T) =>
  Type.Unsafe<T[number]>({
    type: "string",
    enum: values,
  });

export const schedulerToolParameters = Type.Object({
  action: stringEnum(["add", "list", "cancel"] as const),
  time: Type.Optional(Type.String({ description: "24-hour local time in HH:mm format for one-time schedules" })),
  date: Type.Optional(Type.String({ description: "Local date in YYYY-MM-DD format for one-time schedules" })),
  cron: Type.Optional(Type.String({ description: "Cron expression for recurring schedules, e.g. '0 9 * * *' for every day at 09:00 Korea time" })),
  prompt: Type.Optional(Type.String({ description: "Full task prompt to run later in a fresh clean pi session" })),
  id: Type.Optional(Type.String({ description: "Scheduled task id to cancel" })),
  mentionUser: Type.Optional(Type.Boolean({ description: "Mention requester when posting scheduled result in channel. Defaults to true." })),
});

export type SchedulerToolInput = Static<typeof schedulerToolParameters>;
