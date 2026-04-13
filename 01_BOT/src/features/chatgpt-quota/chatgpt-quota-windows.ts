import {
  clampPercent,
  defaultNow,
  isCodeReviewLabel,
  resetAtFromSeconds,
  type ChatGptQuotaCoreUsage,
  type ChatGptQuotaWindow,
  type RawQuotaResponse,
  type RawQuotaWindow,
} from "./chatgpt-quota-shared.js";

const toQuotaWindow = (label: string, rawWindow: RawQuotaWindow | undefined, now: () => Date) => {
  if (!rawWindow) return null;
  const usedPercent = clampPercent(rawWindow.used_percent ?? rawWindow.usedPercent ?? 0);
  const resetAfterSeconds = rawWindow.reset_after_seconds ?? rawWindow.resetAfterSeconds ?? null;
  return {
    label,
    usedPercent,
    remainingPercent: Math.max(0, 100 - usedPercent),
    resetAfterSeconds,
    resetAt: resetAtFromSeconds(resetAfterSeconds, now),
  } satisfies ChatGptQuotaWindow;
};

const pickWindow = (windows: ChatGptQuotaWindow[], pickShortest: boolean) => {
  const primary = windows.find((window) => window.label.toLowerCase().includes("primary"));
  const secondary = windows.find((window) => window.label.toLowerCase().includes("secondary"));
  if (pickShortest && primary) return primary;
  if (!pickShortest && secondary) return secondary;
  return windows.reduce((best, candidate) => {
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
  const core = windows.filter((window) => !isCodeReviewLabel(window.label));
  const fiveHour = core.length ? pickWindow(core, true) : null;
  const weekly = core.length < 2 ? null : pickWindow(core, false);
  if (fiveHour && weekly && fiveHour.label === weekly.label && fiveHour.resetAt === weekly.resetAt) {
    return { fiveHour, weekly: null };
  }
  return { fiveHour, weekly };
};

export const formatChatGptQuotaStatus = (fiveHourUsedPercent: number, weeklyUsedPercent: number | null) =>
  `5h ${fiveHourUsedPercent}% used · Weekly ${weeklyUsedPercent === null ? "n/a" : `${weeklyUsedPercent}% used`}`;
