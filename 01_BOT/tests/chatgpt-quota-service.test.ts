import { AuthStorage } from "@mariozechner/pi-coding-agent";
import { describe, expect, it, vi } from "vitest";

import {
  buildChatGptQuotaStatus,
  createChatGptQuotaStatusService,
  extractChatGptCoreUsage,
  extractChatGptQuotaWindows,
  fetchChatGptQuota,
  formatChatGptQuotaStatus,
  type ChatGptQuotaWindow,
} from "../src/features/chatgpt-quota/chatgpt-quota-service.js";

const makeToken = (payload: Record<string, unknown>) => {
  const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${encode({ alg: "none", typ: "JWT" })}.${encode(payload)}.sig`;
};

const accessToken = makeToken({
  "https://api.openai.com/auth": {
    chatgpt_account_id: "acct_123",
  },
});

const fixedNow = () => new Date("2026-04-13T12:00:00.000Z");
const createWindow = (overrides: Partial<ChatGptQuotaWindow> = {}): ChatGptQuotaWindow => ({
  label: "Primary",
  usedPercent: 24,
  remainingPercent: 76,
  resetAfterSeconds: 3600,
  resetAt: "2026-04-13T13:00:00.000Z",
  ...overrides,
});

describe("chatgpt quota status", () => {
  it("formats status text", () => {
    expect(formatChatGptQuotaStatus(35, 62)).toBe("5h 35% used · Weekly 62% used");
    expect(formatChatGptQuotaStatus(35, null)).toBe("5h 35% used · Weekly n/a");
  });

  it("extracts quota windows from snake and camel response fields", () => {
    expect(extractChatGptQuotaWindows({
      rate_limit: {
        primary_window: { used_percent: 24.4, reset_after_seconds: 3600 },
      },
      codeReviewRateLimit: {
        secondaryWindow: { usedPercent: 62.6 },
      },
    }, fixedNow)).toEqual([
      {
        label: "Primary",
        usedPercent: 24,
        remainingPercent: 76,
        resetAfterSeconds: 3600,
        resetAt: "2026-04-13T13:00:00.000Z",
      },
      {
        label: "Code Review (Secondary)",
        usedPercent: 63,
        remainingPercent: 37,
        resetAfterSeconds: null,
        resetAt: null,
      },
    ]);

    expect(extractChatGptQuotaWindows({
      rateLimit: {
        primaryWindow: { usedPercent: 12 },
      },
    }).map((window) => ({ label: window.label, usedPercent: window.usedPercent }))).toEqual([
      { label: "Primary", usedPercent: 12 },
    ]);

    expect(extractChatGptQuotaWindows({
      rateLimit: {
        primaryWindow: {},
      },
    }, fixedNow)[0]).toEqual({
      label: "Primary",
      usedPercent: 0,
      remainingPercent: 100,
      resetAfterSeconds: null,
      resetAt: null,
    });
  });

  it("derives five-hour and weekly windows from labels or reset length", () => {
    expect(extractChatGptCoreUsage([
      createWindow({ label: "Primary", usedPercent: 20, remainingPercent: 80, resetAfterSeconds: 300, resetAt: "2026-04-13T12:05:00.000Z" }),
      createWindow({ label: "Secondary", usedPercent: 60, remainingPercent: 40, resetAfterSeconds: 7200, resetAt: "2026-04-13T14:00:00.000Z" }),
      createWindow({ label: "Code Review (Primary)", usedPercent: 90, remainingPercent: 10 }),
    ])).toEqual({
      fiveHour: createWindow({ label: "Primary", usedPercent: 20, remainingPercent: 80, resetAfterSeconds: 300, resetAt: "2026-04-13T12:05:00.000Z" }),
      weekly: createWindow({ label: "Secondary", usedPercent: 60, remainingPercent: 40, resetAfterSeconds: 7200, resetAt: "2026-04-13T14:00:00.000Z" }),
    });

    expect(extractChatGptCoreUsage([
      createWindow({ label: "Window A", usedPercent: 10, remainingPercent: 90, resetAfterSeconds: 60, resetAt: "2026-04-13T12:01:00.000Z" }),
      createWindow({ label: "Window B", usedPercent: 55, remainingPercent: 45, resetAfterSeconds: 604800, resetAt: "2026-04-20T12:00:00.000Z" }),
    ])).toEqual({
      fiveHour: createWindow({ label: "Window A", usedPercent: 10, remainingPercent: 90, resetAfterSeconds: 60, resetAt: "2026-04-13T12:01:00.000Z" }),
      weekly: createWindow({ label: "Window B", usedPercent: 55, remainingPercent: 45, resetAfterSeconds: 604800, resetAt: "2026-04-20T12:00:00.000Z" }),
    });

    expect(extractChatGptCoreUsage([
      createWindow({ label: "Window A", usedPercent: 10, remainingPercent: 90, resetAfterSeconds: 500, resetAt: "2026-04-13T12:08:20.000Z" }),
      createWindow({ label: "Window B", usedPercent: 25, remainingPercent: 75, resetAfterSeconds: 100, resetAt: "2026-04-13T12:01:40.000Z" }),
    ])).toEqual({
      fiveHour: createWindow({ label: "Window B", usedPercent: 25, remainingPercent: 75, resetAfterSeconds: 100, resetAt: "2026-04-13T12:01:40.000Z" }),
      weekly: createWindow({ label: "Window A", usedPercent: 10, remainingPercent: 90, resetAfterSeconds: 500, resetAt: "2026-04-13T12:08:20.000Z" }),
    });
  });

  it("omits weekly window when missing or duplicated", () => {
    expect(extractChatGptCoreUsage([
      createWindow({ label: "Primary", resetAfterSeconds: 60, resetAt: "2026-04-13T12:01:00.000Z" }),
    ])).toEqual({
      fiveHour: createWindow({ label: "Primary", resetAfterSeconds: 60, resetAt: "2026-04-13T12:01:00.000Z" }),
      weekly: null,
    });

    expect(extractChatGptCoreUsage([
      createWindow({ label: "Window A", resetAfterSeconds: 60, resetAt: "2026-04-13T12:01:00.000Z" }),
      createWindow({ label: "Window A", resetAfterSeconds: 60, resetAt: "2026-04-13T12:01:00.000Z" }),
    ])).toEqual({
      fiveHour: createWindow({ label: "Window A", resetAfterSeconds: 60, resetAt: "2026-04-13T12:01:00.000Z" }),
      weekly: null,
    });

    expect(extractChatGptCoreUsage([
      createWindow({ label: "Window A", resetAfterSeconds: 60, resetAt: "2026-04-13T12:01:00.000Z" }),
      createWindow({ label: "Window B", resetAfterSeconds: null, resetAt: null }),
    ])).toEqual({
      fiveHour: createWindow({ label: "Window A", resetAfterSeconds: 60, resetAt: "2026-04-13T12:01:00.000Z" }),
      weekly: null,
    });

    expect(extractChatGptCoreUsage([
      createWindow({ label: "Window A", resetAfterSeconds: null, resetAt: null }),
      createWindow({ label: "Window B", resetAfterSeconds: 60, resetAt: "2026-04-13T12:01:00.000Z" }),
    ])).toEqual({
      fiveHour: createWindow({ label: "Window B", resetAfterSeconds: 60, resetAt: "2026-04-13T12:01:00.000Z" }),
      weekly: null,
    });
  });

  it("returns null core usage when only code review windows exist", () => {
    expect(extractChatGptCoreUsage([
      createWindow({ label: "Code Review (Primary)" }),
    ])).toEqual({ fiveHour: null, weekly: null });
  });

  it("fetches quota with expected headers and default api base", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ plan_type: "team" })));

    await expect(fetchChatGptQuota({ accessToken, fetchImpl })).resolves.toEqual({ plan_type: "team" });
    expect(fetchImpl).toHaveBeenCalledWith("https://chatgpt.com/backend-api/wham/usage", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "ChatGPT-Account-Id": "acct_123",
        "User-Agent": "codex_cli_rs/0.76.0 (Debian 13.0.0; x86_64) WindowsTerminal",
      },
    });
  });

  it("rejects invalid tokens and upstream failures", async () => {
    await expect(fetchChatGptQuota({ accessToken: "bad.token", fetchImpl: vi.fn<typeof fetch>() })).rejects.toThrow("Invalid OpenAI Codex access token");
    await expect(fetchChatGptQuota({ accessToken: "header..sig", fetchImpl: vi.fn<typeof fetch>() })).rejects.toThrow("Invalid OpenAI Codex access token");
    await expect(fetchChatGptQuota({
      accessToken: makeToken({ "https://api.openai.com/auth": {} }),
      fetchImpl: vi.fn<typeof fetch>(),
    })).rejects.toThrow("Missing ChatGPT account ID in OpenAI Codex token");
    await expect(fetchChatGptQuota({
      accessToken: makeToken({ "https://api.openai.com/auth": "bad" }),
      fetchImpl: vi.fn<typeof fetch>(),
    })).rejects.toThrow("Missing ChatGPT account ID in OpenAI Codex token");
    await expect(fetchChatGptQuota({
      accessToken,
      apiBase: "https://chatgpt.com/backend-api/",
      fetchImpl: vi.fn<typeof fetch>().mockResolvedValue(new Response("forbidden", { status: 403 })),
    })).rejects.toThrow("ChatGPT quota request failed: 403");
  });

  it("builds status text from auth and quota windows", async () => {
    const authStorage = { getApiKey: vi.fn(async () => accessToken) };
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({
      rate_limit: {
        primary_window: { used_percent: 35, reset_after_seconds: 3600 },
        secondary_window: { used_percent: 62, reset_after_seconds: 604800 },
      },
    })));

    await expect(buildChatGptQuotaStatus({ authStorage, fetchImpl, now: fixedNow })).resolves.toBe("5h 35% used · Weekly 62% used");
  });

  it("handles missing auth and missing weekly/five-hour windows", async () => {
    await expect(buildChatGptQuotaStatus({ authStorage: { getApiKey: vi.fn(async () => undefined) } })).rejects.toThrow("Missing pi auth for provider: openai-codex");

    const createAuthStorage = { getApiKey: vi.fn(async () => accessToken) };
    const createSpy = vi.spyOn(AuthStorage, "create").mockReturnValue(createAuthStorage as unknown as AuthStorage);
    await expect(buildChatGptQuotaStatus({
      fetchImpl: vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({
        rate_limit: {
          primary_window: { used_percent: 22, reset_after_seconds: 60 },
        },
      }))),
    })).resolves.toBe("5h 22% used · Weekly n/a");
    createSpy.mockRestore();

    const authStorage = { getApiKey: vi.fn(async () => accessToken) };
    const weeklyMissingFetch = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({
      rate_limit: {
        primary_window: { used_percent: 12, reset_after_seconds: 60 },
      },
    })));
    await expect(buildChatGptQuotaStatus({ authStorage, fetchImpl: weeklyMissingFetch, now: fixedNow })).resolves.toBe("5h 12% used · Weekly n/a");

    const noWindowFetch = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ rate_limit: {} })));
    await expect(buildChatGptQuotaStatus({ authStorage, fetchImpl: noWindowFetch, now: fixedNow })).rejects.toThrow("ChatGPT quota windows unavailable");
  });

  it("polls once, avoids duplicate start, reports errors, and stops", async () => {
    let intervalHandler: (() => void) | undefined;
    const setIntervalImpl = vi.fn(((handler: TimerHandler) => {
      if (typeof handler !== "function") throw new Error("handler missing");
      intervalHandler = handler as () => void;
      return 7 as unknown as ReturnType<typeof setInterval>;
    }) as unknown as typeof setInterval);
    const clearIntervalImpl = vi.fn();
    const onStatusText = vi.fn();
    const onError = vi.fn();
    let shouldFail = false;
    const fetchImpl = vi.fn<typeof fetch>(async () => {
      if (shouldFail) throw new Error("boom");
      return new Response(JSON.stringify({
        rate_limit: {
          primary_window: { used_percent: 35, reset_after_seconds: 3600 },
          secondary_window: { used_percent: 62, reset_after_seconds: 604800 },
        },
      }));
    });
    const service = createChatGptQuotaStatusService({
      authStorage: { getApiKey: vi.fn(async () => accessToken) },
      fetchImpl,
      now: fixedNow,
      onStatusText,
      onError,
      pollMs: 15_000,
      setIntervalImpl: setIntervalImpl as unknown as typeof setInterval,
      clearIntervalImpl,
    });

    service.start();
    service.start();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(onStatusText).toHaveBeenCalledWith("5h 35% used · Weekly 62% used");
    expect(setIntervalImpl).toHaveBeenCalledTimes(1);

    shouldFail = true;
    intervalHandler?.();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(onError).toHaveBeenCalledWith(expect.any(Error));

    service.stop();
    service.stop();
    expect(clearIntervalImpl).toHaveBeenCalledWith(7);

    const silentService = createChatGptQuotaStatusService({
      authStorage: { getApiKey: vi.fn(async () => accessToken) },
      fetchImpl: vi.fn<typeof fetch>(async () => { throw new Error("boom"); }),
      onStatusText: vi.fn(),
      setIntervalImpl: setIntervalImpl as unknown as typeof setInterval,
      clearIntervalImpl,
    });
    silentService.start();
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
});
