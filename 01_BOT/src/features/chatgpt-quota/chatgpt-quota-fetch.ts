import {
  DEFAULT_REQUEST_TIMEOUT_MS,
  JWT_CLAIM_PATH,
  QUOTA_USER_AGENT,
  normalizeApiBase,
  type FetchLike,
  type RawQuotaResponse,
} from "./chatgpt-quota-shared.js";

const decodeJwtPayload = (token: string) => {
  const parts = token.split(".");
  if (parts.length !== 3 || !parts[1]) throw new Error("Invalid OpenAI Codex access token");
  return JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8")) as Record<string, unknown>;
};

const getAccountIdFromToken = (accessToken: string) => {
  const payload = decodeJwtPayload(accessToken);
  const auth = payload[JWT_CLAIM_PATH];
  const accountId = typeof auth === "object" && auth !== null
    ? (auth as { chatgpt_account_id?: unknown }).chatgpt_account_id
    : undefined;
  if (typeof accountId !== "string" || !accountId.trim()) {
    throw new Error("Missing ChatGPT account ID in OpenAI Codex token");
  }
  return accountId;
};

export const fetchChatGptQuota = async ({
  accessToken,
  apiBase,
  fetchImpl = fetch,
  timeoutMs = DEFAULT_REQUEST_TIMEOUT_MS,
}: {
  accessToken: string;
  apiBase?: string;
  fetchImpl?: FetchLike;
  timeoutMs?: number;
}) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  let response: Response;
  try {
    response = await fetchImpl(`${normalizeApiBase(apiBase)}/wham/usage`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "ChatGPT-Account-Id": getAccountIdFromToken(accessToken),
        "User-Agent": QUOTA_USER_AGENT,
      },
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`ChatGPT quota request timed out after ${timeoutMs}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
  if (!response.ok) throw new Error(`ChatGPT quota request failed: ${response.status}`);
  return await response.json() as RawQuotaResponse;
};
