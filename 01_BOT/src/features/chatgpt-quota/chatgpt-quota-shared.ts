import { AuthStorage } from "@mariozechner/pi-coding-agent";

export const DEFAULT_CHATGPT_API_BASE = "https://chatgpt.com/backend-api";
export const DEFAULT_POLL_MS = 60_000;
export const DEFAULT_REQUEST_TIMEOUT_MS = 5_000;
export const QUOTA_USER_AGENT = "codex_cli_rs/0.76.0 (Debian 13.0.0; x86_64) WindowsTerminal";
export const JWT_CLAIM_PATH = "https://api.openai.com/auth";

export type FetchLike = typeof fetch;
export type AuthReader = Pick<AuthStorage, "getApiKey">;

export type RawQuotaWindow = {
  used_percent?: number;
  usedPercent?: number;
  reset_after_seconds?: number;
  resetAfterSeconds?: number;
};

export type RawQuotaWindows = {
  primary_window?: RawQuotaWindow;
  primaryWindow?: RawQuotaWindow;
  secondary_window?: RawQuotaWindow;
  secondaryWindow?: RawQuotaWindow;
};

export type RawQuotaResponse = {
  plan_type?: string;
  planType?: string;
  rate_limit?: RawQuotaWindows;
  rateLimit?: RawQuotaWindows;
  code_review_rate_limit?: RawQuotaWindows;
  codeReviewRateLimit?: RawQuotaWindows;
};

export type ChatGptQuotaWindow = {
  label: string;
  usedPercent: number;
  remainingPercent: number;
  resetAfterSeconds: number | null;
  resetAt: string | null;
};

export type ChatGptQuotaCoreUsage = {
  fiveHour: ChatGptQuotaWindow | null;
  weekly: ChatGptQuotaWindow | null;
};

export const defaultNow = () => new Date();
export const clampPercent = (value: number) => Math.max(0, Math.min(100, Math.round(value)));
export const normalizeApiBase = (value: string | undefined) =>
  (value?.trim() || DEFAULT_CHATGPT_API_BASE).replace(/\/+$/, "");
export const resetAtFromSeconds = (resetAfterSeconds: number | null, now: () => Date = defaultNow) =>
  resetAfterSeconds && resetAfterSeconds > 0 ? new Date(now().getTime() + resetAfterSeconds * 1000).toISOString() : null;
export const isCodeReviewLabel = (label: string) => label.toLowerCase().includes("code review");
