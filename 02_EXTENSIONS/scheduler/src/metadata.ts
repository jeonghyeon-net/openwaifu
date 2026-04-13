export const schedulerToolDescription =
  "Schedule, list, and cancel one-time or daily tasks for current Discord user/session. Scheduled tasks currently post reminder-style messages, and all times use Korea time (Asia/Seoul).";
export const schedulerToolPromptSnippet =
  "`scheduler`: create, list, or cancel one-time and daily scheduled tasks for current Discord user/session";
export const schedulerToolGuidelines = [
  "Use this tool when user asks to schedule something later, set reminder, wake-up message, recurring alarm, or timed task.",
  "All scheduler times are fixed to Korea time (Asia/Seoul). Do not ask for or use another timezone.",
  "Use recurrence `once` for single scheduled task. If user gives only time, omit `date` and tool schedules next Korea-time occurrence.",
  "Use recurrence `daily` for every-day schedules like '매일 오전 9시'.",
];
