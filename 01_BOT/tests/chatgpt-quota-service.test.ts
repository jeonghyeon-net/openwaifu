import { describe, expect, it, vi } from "vitest";

import { buildChatGptQuotaStatus, createChatGptQuotaStatusService } from "../src/features/chatgpt-quota/chatgpt-quota-service.js";
import { accessToken, fixedNow } from "./chatgpt-quota-test-helpers.js";

describe("chatgpt quota status service", () => {
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

  it("handles missing auth, fallback storage, and unavailable windows", async () => {
    await expect(buildChatGptQuotaStatus({ authStorage: { getApiKey: vi.fn(async () => undefined) } })).rejects.toThrow("Missing pi auth for provider: openai-codex");
    await expect(buildChatGptQuotaStatus({
      authStorageFactory: () => ({ getApiKey: vi.fn(async () => accessToken) }),
      fetchImpl: vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ rate_limit: { primary_window: { used_percent: 22, reset_after_seconds: 60 } } }))),
    })).resolves.toBe("5h 22% used · Weekly n/a");

    const authStorage = { getApiKey: vi.fn(async () => accessToken) };
    const weeklyMissingFetch = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ rate_limit: { primary_window: { used_percent: 12, reset_after_seconds: 60 } } })));
    await expect(buildChatGptQuotaStatus({ authStorage, fetchImpl: weeklyMissingFetch, now: fixedNow })).resolves.toBe("5h 12% used · Weekly n/a");
    await expect(buildChatGptQuotaStatus({ authStorage, fetchImpl: vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ rate_limit: {} }))), now: fixedNow })).rejects.toThrow("ChatGPT quota windows unavailable");
  });

  it("polls once, avoids duplicate start, reports errors, and stops", async () => {
    let intervalHandler: (() => void) | undefined;
    const setIntervalImpl = (handler: TimerHandler) => {
      if (typeof handler !== "function") throw new Error("handler missing");
      intervalHandler = () => handler();
      const timer = setInterval(() => undefined, 60_000);
      clearInterval(timer);
      return timer;
    };
    const clearIntervalImpl = vi.fn<typeof clearInterval>();
    const onStatusText = vi.fn();
    const onError = vi.fn();
    let shouldFail = false;
    const fetchImpl = vi.fn<typeof fetch>(async () => {
      if (shouldFail) throw new Error("boom");
      return new Response(JSON.stringify({ rate_limit: { primary_window: { used_percent: 35, reset_after_seconds: 3600 }, secondary_window: { used_percent: 62, reset_after_seconds: 604800 } } }));
    });
    const service = createChatGptQuotaStatusService({ authStorage: { getApiKey: vi.fn(async () => accessToken) }, fetchImpl, now: fixedNow, onStatusText, onError, pollMs: 15_000, setIntervalImpl, clearIntervalImpl });

    service.start();
    service.start();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(onStatusText).toHaveBeenCalledWith("5h 35% used · Weekly 62% used");
    shouldFail = true;
    intervalHandler?.();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(onError).toHaveBeenCalledWith(expect.any(Error));

    service.stop();
    service.stop();
    expect(clearIntervalImpl).toHaveBeenCalledTimes(1);

    const silentService = createChatGptQuotaStatusService({ authStorage: { getApiKey: vi.fn(async () => accessToken) }, fetchImpl: vi.fn<typeof fetch>(async () => { throw new Error("boom"); }), onStatusText: vi.fn(), setIntervalImpl, clearIntervalImpl });
    silentService.start();
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
});
