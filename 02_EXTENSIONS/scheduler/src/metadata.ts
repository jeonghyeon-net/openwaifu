export const schedulerToolDescription =
  "Create, list, and cancel one-time or daily Discord reminders for current user/session. All reminder times use Korea time (Asia/Seoul).";
export const schedulerToolPromptSnippet =
  "`scheduler_reminder`: create, list, or cancel one-time and daily reminders for current Discord user/session";
export const schedulerToolGuidelines = [
  "Use this tool when user asks for reminder, wake-up message, recurring alarm, or scheduled notification.",
  "All reminder times are fixed to Korea time (Asia/Seoul). Do not ask for or use another timezone.",
  "Use recurrence `once` for single reminder. If user gives only time, omit `date` and tool schedules next Korea-time occurrence.",
  "Use recurrence `daily` for every-day reminders like '매일 오전 9시'.",
];
