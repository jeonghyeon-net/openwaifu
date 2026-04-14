import { describe, expect, it, vi } from "vitest";

import { fetchChatGptQuota } from "../src/features/chatgpt-quota/chatgpt-quota-service.js";
import { accessToken, makeToken } from "./chatgpt-quota-test-helpers.js";

describe("chatgpt quota fetch", () => {
  it("fetches quota with expected headers and default api base", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ plan_type: "team" })));
    await expect(fetchChatGptQuota({ accessToken, fetchImpl })).resolves.toEqual({ plan_type: "team" });
    expect(fetchImpl).toHaveBeenCalledWith("https://chatgpt.com/backend-api/wham/usage", expect.objectContaining({
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "ChatGPT-Account-Id": "acct_123",
        "User-Agent": "codex_cli_rs/0.76.0 (Debian 13.0.0; x86_64) WindowsTerminal",
      },
      signal: expect.any(AbortSignal),
    }));
  });

  it("rejects invalid tokens, upstream failures, and timeouts", async () => {
    await expect(fetchChatGptQuota({ accessToken: "bad.token", fetchImpl: vi.fn<typeof fetch>() })).rejects.toThrow("Invalid OpenAI Codex access token");
    await expect(fetchChatGptQuota({ accessToken: "header..sig", fetchImpl: vi.fn<typeof fetch>() })).rejects.toThrow("Invalid OpenAI Codex access token");
    await expect(fetchChatGptQuota({ accessToken: makeToken({ "https://api.openai.com/auth": {} }), fetchImpl: vi.fn<typeof fetch>() })).rejects.toThrow("Missing ChatGPT account ID in OpenAI Codex token");
    await expect(fetchChatGptQuota({ accessToken: makeToken({ "https://api.openai.com/auth": "bad" }), fetchImpl: vi.fn<typeof fetch>() })).rejects.toThrow("Missing ChatGPT account ID in OpenAI Codex token");
    await expect(fetchChatGptQuota({ accessToken, apiBase: "https://chatgpt.com/backend-api/", fetchImpl: vi.fn<typeof fetch>().mockResolvedValue(new Response("forbidden", { status: 403 })) })).rejects.toThrow("ChatGPT quota request failed: 403");
    await expect(fetchChatGptQuota({
      accessToken,
      timeoutMs: 1,
      fetchImpl: vi.fn<typeof fetch>((_input, init) => new Promise((_, reject) => {
        init?.signal?.addEventListener("abort", () => reject(Object.assign(new Error("aborted"), { name: "AbortError" })));
      })),
    })).rejects.toThrow("ChatGPT quota request timed out after 1ms");
  });
});
