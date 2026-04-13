import { AuthStorage } from "@mariozechner/pi-coding-agent";

import { fixedPiProvider } from "../../config/pi-config.js";

const DEFAULT_CHATGPT_API_BASE = "https://chatgpt.com/backend-api";
const DEFAULT_POLL_MS = 60_000;
const QUOTA_USER_AGENT = "codex_cli_rs/0.76.0 (Debian 13.0.0; x86_64) WindowsTerminal";
const JWT_CLAIM_PATH = "https://api.openai.com/auth";

type FetchLike = typeof fetch;
type AuthReader = Pick<AuthStorage, "getApiKey">;

type RawQuotaWindow = {
  used_percent?: number;
  usedPercent?: number;
  reset_after_seconds?: number;
  resetAfterSeconds?: number;
};

type RawQuotaWindows = {
  primary_window?: RawQuotaWindow;
  primaryWindow?: RawQuotaWindow;
  secondary_window?: RawQuotaWindow;
  secondaryWindow?: RawQuotaWindow;
};

type RawQuotaResponse = {
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

export type ChatGptQuotaStatusService = {
  start(): void;
  stop(): void;
  refresh(): Promise<void>;
};

const decodeJwtPayload = (token: string) => {
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("Invalid OpenAI Codex access token");
  const payload = parts[1];
  if (!payload) throw new Error("Invalid OpenAI Codex access token");
  return JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Record<string, unknown>;
};

const defaultNow = () => new Date();
const clampPercent = (value: number) => Math.max(0, Math.min(100, Math.round(value)));
const normalizeApiBase = (value: string | undefined) => (value?.trim() || DEFAULT_CHATGPT_API_BASE).replace(/\/+$/, "");
const resetAtFromSeconds = (resetAfterSeconds: number | null, now: () => Date = defaultNow) =>
  resetAfterSeconds && resetAfterSeconds > 0 ? new Date(now().getTime() + resetAfterSeconds * 1000).toISOString() : null;
const isCodeReviewLabel = (label: string) => label.toLowerCase().includes("code review");

const getAccountIdFromToken = (accessToken: string) => {
  const payload = decodeJwtPayload(accessToken);
  const auth = payload[JWT_CLAIM_PATH];
  const accountId = typeof auth === "object" && auth !== null ? (auth as { chatgpt_account_id?: unknown }).chatgpt_account_id : undefined;
  if (typeof accountId !== "string" || !accountId.trim()) throw new Error("Missing ChatGPT account ID in OpenAI Codex token");
  return accountId;
};

const toQuotaWindow = (label: string, rawWindow: RawQuotaWindow | undefined, now: () => Date) => {
  if (!rawWindow) return null;
  const usedPercentRaw = rawWindow.used_percent ?? rawWindow.usedPercent ?? 0;
  const resetAfterSeconds = rawWindow.reset_after_seconds ?? rawWindow.resetAfterSeconds ?? null;
  const usedPercent = clampPercent(usedPercentRaw);
  return {
    label,
    usedPercent,
    remainingPercent: Math.max(0, 100 - usedPercent),
    resetAfterSeconds,
    resetAt: resetAtFromSeconds(resetAfterSeconds, now),
  } satisfies ChatGptQuotaWindow;
};

const pickWindow = (windows: ChatGptQuotaWindow[], pickShortest: boolean) => {
  const filtered = windows.filter((window) => !isCodeReviewLabel(window.label));
  if (filtered.length === 0) return null;
  const primary = filtered.find((window) => window.label.toLowerCase().includes("primary"));
  const secondary = filtered.find((window) => window.label.toLowerCase().includes("secondary"));
  if (pickShortest && primary) return primary;
  if (!pickShortest && secondary) return secondary;
  return filtered.reduce((best, candidate) => {
    if (best.resetAfterSeconds === null) return candidate;
    if (candidate.resetAfterSeconds === null) return best;
    return pickShortest
      ? candidate.resetAfterSeconds < best.resetAfterSeconds ? candidate : best
      : candidate.resetAfterSeconds > best.resetAfterSeconds ? candidate : best;
  });
};

export const extractChatGptQuotaWindows = (payload: RawQuotaResponse, now: () => Date = defaultNow) => {
  const rateLimit = payload.rate_limit ?? payload.rateLimit;
  const codeReview = payload.code_review_rate_limit ?? payload.codeReviewRateLimit;
  return [
    toQuotaWindow("Primary", rateLimit?.primary_window ?? rateLimit?.primaryWindow, now),
    toQuotaWindow("Secondary", rateLimit?.secondary_window ?? rateLimit?.secondaryWindow, now),
    toQuotaWindow("Code Review (Primary)", codeReview?.primary_window ?? codeReview?.primaryWindow, now),
    toQuotaWindow("Code Review (Secondary)", codeReview?.secondary_window ?? codeReview?.secondaryWindow, now),
  ].filter((window): window is ChatGptQuotaWindow => window !== null);
};

export const extractChatGptCoreUsage = (windows: ChatGptQuotaWindow[]): ChatGptQuotaCoreUsage => {
  const nonCodeReviewWindows = windows.filter((window) => !isCodeReviewLabel(window.label));
  const fiveHour = pickWindow(nonCodeReviewWindows, true);
  const weekly = nonCodeReviewWindows.length < 2 ? null : pickWindow(nonCodeReviewWindows, false);
  if (fiveHour && weekly && fiveHour.label === weekly.label && fiveHour.resetAt === weekly.resetAt) {
    return { fiveHour, weekly: null };
  }
  return { fiveHour, weekly };
};

export const formatChatGptQuotaStatus = (fiveHourUsedPercent: number, weeklyUsedPercent: number | null) =>
  `5h ${fiveHourUsedPercent}% used · Weekly ${weeklyUsedPercent === null ? "n/a" : `${weeklyUsedPercent}% used`}`;

export const fetchChatGptQuota = async ({
  accessToken,
  apiBase,
  fetchImpl = fetch,
}: {
  accessToken: string;
  apiBase?: string;
  fetchImpl?: FetchLike;
}) => {
  const response = await fetchImpl(`${normalizeApiBase(apiBase)}/wham/usage`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "ChatGPT-Account-Id": getAccountIdFromToken(accessToken),
      "User-Agent": QUOTA_USER_AGENT,
    },
  });

  if (!response.ok) throw new Error(`ChatGPT quota request failed: ${response.status}`);
  return await response.json() as RawQuotaResponse;
};

export const buildChatGptQuotaStatus = async ({
  authStorage,
  apiBase,
  fetchImpl,
  now = defaultNow,
}: {
  authStorage?: AuthReader;
  apiBase?: string;
  fetchImpl?: FetchLike;
  now?: () => Date;
}) => {
  const resolvedAuthStorage = authStorage ?? AuthStorage.create();
  const accessToken = await resolvedAuthStorage.getApiKey(fixedPiProvider);
  if (!accessToken) throw new Error(`Missing pi auth for provider: ${fixedPiProvider}`);

  const payload = await fetchChatGptQuota({ accessToken, apiBase, fetchImpl });
  const coreUsage = extractChatGptCoreUsage(extractChatGptQuotaWindows(payload, now));
  if (!coreUsage.fiveHour) throw new Error("ChatGPT quota windows unavailable");
  return formatChatGptQuotaStatus(coreUsage.fiveHour.usedPercent, coreUsage.weekly?.usedPercent ?? null);
};

export const createChatGptQuotaStatusService = ({
  onStatusText,
  onError = () => undefined,
  authStorage,
  apiBase,
  fetchImpl,
  now,
  pollMs = DEFAULT_POLL_MS,
  setIntervalImpl = setInterval,
  clearIntervalImpl = clearInterval,
}: {
  onStatusText: (text: string) => void;
  onError?: (error: unknown) => void;
  authStorage?: AuthReader;
  apiBase?: string;
  fetchImpl?: FetchLike;
  now?: () => Date;
  pollMs?: number;
  setIntervalImpl?: typeof setInterval;
  clearIntervalImpl?: typeof clearInterval;
}): ChatGptQuotaStatusService => {
  let timer: ReturnType<typeof setInterval> | undefined;

  const refresh = async () => {
    const text = await buildChatGptQuotaStatus({ authStorage, apiBase, fetchImpl, now });
    onStatusText(text);
  };

  const tick = () => {
    void refresh().catch(onError);
  };

  return {
    start() {
      if (timer) return;
      tick();
      timer = setIntervalImpl(tick, pollMs);
    },
    stop() {
      if (!timer) return;
      clearIntervalImpl(timer);
      timer = undefined;
    },
    refresh,
  };
};
