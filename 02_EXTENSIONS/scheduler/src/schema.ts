import { StringEnum } from "@mariozechner/pi-ai";
import { Type, type Static } from "@sinclair/typebox";

export const schedulerToolParameters = Type.Object({
  action: StringEnum(["add", "list", "cancel"] as const),
  recurrence: Type.Optional(StringEnum(["once", "daily"] as const)),
  time: Type.Optional(Type.String({ description: "24-hour local time in HH:mm format" })),
  date: Type.Optional(Type.String({ description: "Local date in YYYY-MM-DD format for one-time reminders" })),
  message: Type.Optional(Type.String({ description: "Reminder text to send" })),
  id: Type.Optional(Type.String({ description: "Reminder id to cancel" })),
  mentionUser: Type.Optional(Type.Boolean({ description: "Mention requester when posting in channel. Defaults to true." })),
});

export type SchedulerToolInput = Static<typeof schedulerToolParameters>;
