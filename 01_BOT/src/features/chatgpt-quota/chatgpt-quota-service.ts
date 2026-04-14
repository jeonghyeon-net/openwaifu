import { AuthStorage } from "@mariozechner/pi-coding-agent";

import { fixedPiProvider } from "../../config/pi-config.js";
import { fetchChatGptQuota } from "./chatgpt-quota-fetch.js";
import { DEFAULT_POLL_MS, DEFAULT_REQUEST_TIMEOUT_MS, defaultNow, type AuthReader, type FetchLike } from "./chatgpt-quota-shared.js";
import { extractChatGptCoreUsage, extractChatGptQuotaWindows, formatChatGptQuotaStatus } from "./chatgpt-quota-windows.js";

export { fetchChatGptQuota } from "./chatgpt-quota-fetch.js";
export { extractChatGptCoreUsage, extractChatGptQuotaWindows, formatChatGptQuotaStatus } from "./chatgpt-quota-windows.js";
export type { ChatGptQuotaCoreUsage, ChatGptQuotaWindow } from "./chatgpt-quota-shared.js";

type TimerHandle = ReturnType<typeof setInterval> | number;
type SetIntervalLike = (handler: TimerHandler, timeout?: number) => TimerHandle;
type ClearIntervalLike = (timer: TimerHandle) => void;

export type ChatGptQuotaStatusService = {
  start(): void;
  stop(): void;
  refresh(): Promise<void>;
};

export const buildChatGptQuotaStatus = async ({
  authStorage,
  authStorageFactory = AuthStorage.create,
  apiBase,
  fetchImpl,
  now = defaultNow,
  timeoutMs = DEFAULT_REQUEST_TIMEOUT_MS,
}: {
  authStorage?: AuthReader;
  authStorageFactory?: () => AuthReader;
  apiBase?: string;
  fetchImpl?: FetchLike;
  now?: () => Date;
  timeoutMs?: number;
}) => {
  const resolvedAuthStorage = authStorage ?? authStorageFactory();
  const accessToken = await resolvedAuthStorage.getApiKey(fixedPiProvider);
  if (!accessToken) throw new Error(`Missing pi auth for provider: ${fixedPiProvider}`);
  const payload = await fetchChatGptQuota({ accessToken, apiBase, fetchImpl, timeoutMs });
  const coreUsage = extractChatGptCoreUsage(extractChatGptQuotaWindows(payload, now));
  if (!coreUsage.fiveHour) throw new Error("ChatGPT quota windows unavailable");
  return formatChatGptQuotaStatus(coreUsage.fiveHour.usedPercent, coreUsage.weekly?.usedPercent ?? null);
};

export const reportChatGptQuotaStatusError = (error: unknown, logger: Pick<Console, "error"> = console) => {
  logger.error("ChatGPT quota status update failed:", String(error));
};

export const createChatGptQuotaStatusService = ({
  onStatusText,
  onError,
  authStorage,
  apiBase,
  fetchImpl,
  now,
  pollMs = DEFAULT_POLL_MS,
  timeoutMs = DEFAULT_REQUEST_TIMEOUT_MS,
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
  timeoutMs?: number;
  setIntervalImpl?: SetIntervalLike;
  clearIntervalImpl?: ClearIntervalLike;
}): ChatGptQuotaStatusService => {
  let timer: TimerHandle | undefined;
  let refreshing = false;
  const refresh = async () => onStatusText(await buildChatGptQuotaStatus({ authStorage, apiBase, fetchImpl, now, timeoutMs }));
  const tick = () => {
    if (refreshing) return;
    refreshing = true;
    void refresh()
      .catch((error) => onError?.(error))
      .finally(() => {
        refreshing = false;
      });
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
