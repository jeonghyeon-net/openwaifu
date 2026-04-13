import type { ChatGptQuotaWindow } from "../src/features/chatgpt-quota/chatgpt-quota-service.js";

export const makeToken = (payload: Record<string, unknown>) => {
  const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${encode({ alg: "none", typ: "JWT" })}.${encode(payload)}.sig`;
};

export const accessToken = makeToken({
  "https://api.openai.com/auth": { chatgpt_account_id: "acct_123" },
});

export const fixedNow = () => new Date("2026-04-13T12:00:00.000Z");

export const createWindow = (overrides: Partial<ChatGptQuotaWindow> = {}): ChatGptQuotaWindow => ({
  label: "Primary",
  usedPercent: 24,
  remainingPercent: 76,
  resetAfterSeconds: 3600,
  resetAt: "2026-04-13T13:00:00.000Z",
  ...overrides,
});
