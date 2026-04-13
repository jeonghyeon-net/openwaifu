// src/tool.ts
import { defineTool } from "@mariozechner/pi-coding-agent";

// src/metadata.ts
var schedulerToolDescription = "Create, list, and cancel one-time or daily Discord reminders for current user/session. All reminder times use Korea time (Asia/Seoul).";
var schedulerToolPromptSnippet = "`scheduler_reminder`: create, list, or cancel one-time and daily reminders for current Discord user/session";
var schedulerToolGuidelines = [
  "Use this tool when user asks for reminder, wake-up message, recurring alarm, or scheduled notification.",
  "All reminder times are fixed to Korea time (Asia/Seoul). Do not ask for or use another timezone.",
  "Use recurrence `once` for single reminder. If user gives only time, omit `date` and tool schedules next Korea-time occurrence.",
  "Use recurrence `daily` for every-day reminders like '\uB9E4\uC77C \uC624\uC804 9\uC2DC'."
];

// src/schema.ts
import { Type } from "@sinclair/typebox";
var stringEnum = (values) => Type.Unsafe({
  type: "string",
  enum: values
});
var schedulerToolParameters = Type.Object({
  action: stringEnum(["add", "list", "cancel"]),
  recurrence: Type.Optional(stringEnum(["once", "daily"])),
  time: Type.Optional(Type.String({ description: "24-hour local time in HH:mm format" })),
  date: Type.Optional(Type.String({ description: "Local date in YYYY-MM-DD format for one-time reminders" })),
  message: Type.Optional(Type.String({ description: "Reminder text to send" })),
  id: Type.Optional(Type.String({ description: "Reminder id to cancel" })),
  mentionUser: Type.Optional(Type.Boolean({ description: "Mention requester when posting in channel. Defaults to true." }))
});

// src/add-action.ts
import { DateTime as DateTime2 } from "luxon";

// ../../01_BOT/src/features/scheduler/reminder-time.ts
import { DateTime } from "luxon";
var timePattern = /^([01]\d|2[0-3]):([0-5]\d)$/;
var datePattern = /^\d{4}-\d{2}-\d{2}$/;
var toUtcIso = (value) => {
  const iso = value.toUTC().toISO();
  if (!iso) throw new Error("Failed to serialize reminder time");
  return iso;
};
var parseTime = (time) => {
  const match = timePattern.exec(time);
  if (!match) throw new Error(`Invalid time: ${time}. Use HH:mm.`);
  return { hour: Number(match[1]), minute: Number(match[2]) };
};
var assertDate = (date) => {
  if (date === void 0 || datePattern.test(date)) return;
  throw new Error(`Invalid date: ${date}. Use YYYY-MM-DD.`);
};
var assertTimezone = (timezone) => {
  if (DateTime.now().setZone(timezone).isValid) return;
  throw new Error(`Invalid timezone: ${timezone}`);
};
var scheduleClock = (value, hour, minute) => value.set({ hour, minute, second: 0, millisecond: 0 });
var nextReminderRunAt = (input, now = DateTime.now()) => {
  assertTimezone(input.timezone);
  assertDate(input.date);
  const { hour, minute } = parseTime(input.time);
  const zonedNow = now.setZone(input.timezone);
  if (input.recurrence === "daily") {
    const scheduled2 = scheduleClock(zonedNow, hour, minute);
    return toUtcIso(scheduled2 <= zonedNow ? scheduled2.plus({ days: 1 }) : scheduled2);
  }
  if (input.date) {
    const scheduled2 = DateTime.fromISO(`${input.date}T${input.time}`, { zone: input.timezone, setZone: true });
    if (!scheduled2.isValid) throw new Error(`Invalid date/time: ${input.date} ${input.time}`);
    if (scheduled2 <= zonedNow) throw new Error("Scheduled time must be in future");
    return toUtcIso(scheduled2);
  }
  const scheduled = scheduleClock(zonedNow, hour, minute);
  return toUtcIso(scheduled <= zonedNow ? scheduled.plus({ days: 1 }) : scheduled);
};
var describeReminder = (reminder) => {
  const runAt = DateTime.fromISO(reminder.nextRunAt, { zone: "utc" }).setZone(reminder.timezone);
  if (reminder.recurrence === "daily") return `every day ${runAt.toFormat("HH:mm")} (${reminder.timezone})`;
  return `${runAt.toFormat("yyyy-LL-dd HH:mm")} (${reminder.timezone})`;
};

// src/helpers.ts
import { randomUUID } from "node:crypto";

// ../../01_BOT/src/features/scheduler/reminder-paths.ts
import { join } from "node:path";
var remindersDirectoryForCwd = (cwd) => join(cwd, "01_BOT", ".data", "scheduler");
var remindersFileForCwd = (cwd) => join(remindersDirectoryForCwd(cwd), "reminders.json");

// ../../01_BOT/src/features/scheduler/reminder-store.ts
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
var reminderStoreStateSymbol = Symbol.for("openwaifu.reminderStoreState");
var reminderStoreState = () => {
  const scope = globalThis;
  scope[reminderStoreStateSymbol] ??= { mutexes: /* @__PURE__ */ new Map() };
  return scope[reminderStoreStateSymbol];
};
var acquireLock = async (filePath) => {
  const state = reminderStoreState();
  const mutex = state.mutexes.get(filePath) ?? { locked: false, waiters: [] };
  state.mutexes.set(filePath, mutex);
  if (!mutex.locked) {
    mutex.locked = true;
    return () => releaseLock(filePath);
  }
  await new Promise((resolve) => mutex.waiters.push(resolve));
  return () => releaseLock(filePath);
};
var releaseLock = (filePath) => {
  const mutex = reminderStoreState().mutexes.get(filePath);
  const waiter = mutex.waiters.shift();
  if (waiter) {
    waiter();
    return;
  }
  reminderStoreState().mutexes.delete(filePath);
};
var ensureStoreFile = async (filePath) => {
  await mkdir(dirname(filePath), { recursive: true });
  try {
    await readFile(filePath, "utf8");
  } catch {
    await writeFile(filePath, "[]\n", "utf8");
  }
};
var parseReminders = (content) => {
  const trimmed = content.trim();
  if (!trimmed) return [];
  return JSON.parse(trimmed);
};
var writeReminders = async (filePath, reminders) => {
  const tempPath = `${filePath}.tmp`;
  await writeFile(tempPath, `${JSON.stringify(reminders, null, 2)}
`, "utf8");
  await rename(tempPath, filePath);
};
var listReminders = async (filePath) => {
  await ensureStoreFile(filePath);
  return parseReminders(await readFile(filePath, "utf8"));
};
var mutateReminders = async (filePath, mutate) => {
  const release = await acquireLock(filePath);
  try {
    const current = await listReminders(filePath);
    const next = await mutate(current);
    await writeReminders(filePath, next.reminders);
    return next.result;
  } finally {
    release();
  }
};

// ../../01_BOT/src/integrations/pi/discord-session-context.ts
var discordSessionContextSymbol = Symbol.for(
  "openwaifu.discordSessionContextState"
);
var discordSessionContextState = () => {
  const scope = globalThis;
  scope[discordSessionContextSymbol] ??= { contexts: /* @__PURE__ */ new Map() };
  return scope[discordSessionContextSymbol];
};
var getDiscordSessionContext = (sessionFile) => discordSessionContextState().contexts.get(sessionFile);

// src/helpers.ts
var defaultTimezone = () => "Asia/Seoul";
var makeId = () => randomUUID().slice(0, 8);
var sortReminders = (reminders) => [...reminders].sort((left, right) => left.nextRunAt.localeCompare(right.nextRunAt));
var scopeReminders = (reminders, scopeId) => sortReminders(reminders.filter((reminder) => reminder.scopeId === scopeId));
var response = (action, reminders, text, extra = {}) => ({ content: [{ type: "text", text }], details: { action, reminders, ...extra } });
var resolveExecution = (ctx, deps = {}) => ({
  remindersFile: remindersFileForCwd(ctx.cwd),
  listRemindersFn: deps.listRemindersFn ?? listReminders,
  mutateRemindersFn: deps.mutateRemindersFn ?? mutateReminders,
  sessionContext: ctx.sessionFile ? (deps.getSessionContextFn ?? getDiscordSessionContext)(ctx.sessionFile) : void 0
});

// src/add-action.ts
var addReminderAction = async (params, scopeId, sessionContext, remindersFile, currentScopeReminders, deps) => {
  if (!params.recurrence || !params.time || !params.message) {
    return response("add", currentScopeReminders, "Error: recurrence, time, and message required for add.", {
      error: "recurrence, time, and message required for add."
    });
  }
  const timezone = defaultTimezone();
  try {
    const now = deps.now?.() ?? DateTime2.now();
    const reminder = {
      id: deps.createId?.() ?? makeId(),
      scopeId,
      authorId: sessionContext.discordContext.authorId,
      channelId: sessionContext.discordContext.channelId,
      guildId: sessionContext.discordContext.guildId,
      isDirectMessage: sessionContext.discordContext.isDirectMessage,
      recurrence: params.recurrence,
      message: params.message,
      timezone,
      scheduledTime: params.time,
      scheduledDate: params.date,
      mentionUser: params.mentionUser ?? true,
      createdAt: now.toUTC().toISO(),
      nextRunAt: nextReminderRunAt({ recurrence: params.recurrence, time: params.time, date: params.date, timezone }, now)
    };
    const reminders = await deps.mutateRemindersFn(remindersFile, async (existing) => ({
      reminders: sortReminders([...existing, reminder]),
      result: scopeReminders([...existing, reminder], scopeId)
    }));
    return response("add", reminders, `Scheduled ${reminder.id} for ${describeReminder(reminder)}.`, { created: reminder });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return response("add", currentScopeReminders, `Error: ${message}`, { error: message });
  }
};

// src/cancel-action.ts
var cancelReminderAction = async (reminderId, scopeId, remindersFile, currentScopeReminders, deps) => {
  if (!reminderId) {
    return response("cancel", currentScopeReminders, "Error: id required for cancel.", {
      error: "id required for cancel."
    });
  }
  const result = await deps.mutateRemindersFn(remindersFile, async (existing) => {
    const scoped = scopeReminders(existing, scopeId);
    if (!scoped.some((reminder) => reminder.id === reminderId)) {
      return { reminders: existing, result: { removed: false, reminders: scoped } };
    }
    const reminders = existing.filter(
      (reminder) => !(reminder.scopeId === scopeId && reminder.id === reminderId)
    );
    return { reminders, result: { removed: true, reminders: scopeReminders(reminders, scopeId) } };
  });
  if (!result.removed) {
    return response("cancel", result.reminders, `Reminder not found: ${reminderId}`, {
      error: `Reminder not found: ${reminderId}`
    });
  }
  return response("cancel", result.reminders, `Cancelled reminder ${reminderId}.`, { removedId: reminderId });
};

// src/list-action.ts
var listReminderAction = (reminders) => {
  if (reminders.length === 0) return response("list", [], "No reminders scheduled.");
  const lines = reminders.map(
    (reminder) => `- ${reminder.id}: ${describeReminder(reminder)} -> ${reminder.message}`
  );
  return response("list", reminders, lines.join("\n"));
};

// src/execute.ts
var executeSchedulerAction = async (params, ctx, deps = {}) => {
  const resolved = resolveExecution(ctx, deps);
  if (!resolved.sessionContext) {
    return response(params.action, [], "Error: Discord session context unavailable.", {
      error: "Discord session context unavailable."
    });
  }
  const currentReminders = await resolved.listRemindersFn(resolved.remindersFile);
  const currentScopeReminders = scopeReminders(currentReminders, resolved.sessionContext.scopeId);
  if (params.action === "list") return listReminderAction(currentScopeReminders);
  if (params.action === "cancel") {
    return cancelReminderAction(params.id, resolved.sessionContext.scopeId, resolved.remindersFile, currentScopeReminders, {
      mutateRemindersFn: resolved.mutateRemindersFn
    });
  }
  return addReminderAction(
    params,
    resolved.sessionContext.scopeId,
    resolved.sessionContext,
    resolved.remindersFile,
    currentScopeReminders,
    { ...deps, mutateRemindersFn: resolved.mutateRemindersFn }
  );
};

// src/tool.ts
var createSchedulerTool = () => defineTool({
  name: "scheduler_reminder",
  label: "Scheduler Reminder",
  description: schedulerToolDescription,
  promptSnippet: schedulerToolPromptSnippet,
  promptGuidelines: schedulerToolGuidelines,
  parameters: schedulerToolParameters,
  execute: async (_toolCallId, params, _signal, _onUpdate, ctx) => executeSchedulerAction(params, {
    cwd: ctx.cwd,
    sessionFile: ctx.sessionManager.getSessionFile()
  })
});

// src/index.ts
function index_default(pi) {
  pi.registerTool(createSchedulerTool());
}
export {
  index_default as default
};
