export const schedulerToolDescription =
  "Schedule, update, list, and cancel one-time or cron-based recurring tasks for current Discord user/session. Each due task runs the saved prompt in a completely fresh clean pi session, then posts the result back to Discord. All times use Korea time (Asia/Seoul).";
export const schedulerToolPromptSnippet =
  "`scheduler`: create, update, list, or cancel one-time and cron-based scheduled tasks that run later in a fresh clean pi session for current Discord user/session";
export const schedulerToolGuidelines = [
  "Use this tool when user asks to run some task later, set recurring schedule, change existing schedule, or execute timed work in future.",
  "Every scheduled run executes in a completely fresh clean pi session. Do not rely on current conversation history surviving until trigger time.",
  "Put full task instructions and needed context into `prompt`, because future run will not inherit current chat state.",
  "All scheduler times are fixed to Korea time (Asia/Seoul). Do not ask for or use another timezone.",
  "For one-time schedules, use `time` and optional `date`. If user gives only time, omit `date` and tool schedules next Korea-time occurrence.",
  "For recurring schedules, use `cron`. Example: every day 09:00 => `0 9 * * *`, weekdays 10:30 => `30 10 * * 1-5`.",
  "To modify an existing task, call `list` first if needed, then use `update` with task `id` and only fields that should change.",
];
