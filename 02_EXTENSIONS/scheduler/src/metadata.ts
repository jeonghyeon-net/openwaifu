export const schedulerToolDescription =
  "Schedule, list, and cancel one-time or daily tasks for current Discord user/session. Each due task runs the saved prompt in a completely fresh clean pi session, then posts the result back to Discord. All times use Korea time (Asia/Seoul).";
export const schedulerToolPromptSnippet =
  "`scheduler`: create, list, or cancel one-time and daily scheduled tasks that run later in a fresh clean pi session for current Discord user/session";
export const schedulerToolGuidelines = [
  "Use this tool when user asks to run some task later, set recurring schedule, or execute timed work in future.",
  "Every scheduled run executes in a completely fresh clean pi session. Do not rely on current conversation history surviving until trigger time.",
  "Put full task instructions and needed context into `prompt`, because future run will not inherit current chat state.",
  "All scheduler times are fixed to Korea time (Asia/Seoul). Do not ask for or use another timezone.",
  "Use recurrence `once` for single scheduled task. If user gives only time, omit `date` and tool schedules next Korea-time occurrence.",
  "Use recurrence `daily` for every-day schedules like '매일 오전 9시'.",
];
