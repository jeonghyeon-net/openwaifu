import { describe, expect, it, vi } from "vitest";

import { ensureProviderAuth } from "../src/integrations/pi/ensure-provider-auth.js";

describe("ensureProviderAuth", () => {
  it("returns when provider auth exists", async () => {
    const getApiKey = vi.fn(async () => "token");
    await expect(ensureProviderAuth({ getApiKey }, "openai")).resolves.toBeUndefined();
    expect(getApiKey).toHaveBeenCalledWith("openai");
  });

  it("throws when provider auth missing", async () => {
    const getApiKey = vi.fn(async () => undefined);
    await expect(ensureProviderAuth({ getApiKey }, "openai-codex")).rejects.toThrow(
      "Missing auth for provider: openai-codex",
    );
  });
});
