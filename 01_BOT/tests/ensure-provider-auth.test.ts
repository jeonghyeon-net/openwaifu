import { describe, expect, it, vi } from "vitest";

import { ensureProviderAuth } from "../src/integrations/pi/ensure-provider-auth.js";

describe("ensureProviderAuth", () => {
  it("returns when pi auth exists", async () => {
    const getApiKey = vi.fn(async () => "token");
    await expect(ensureProviderAuth({ getApiKey })).resolves.toBeUndefined();
    expect(getApiKey).toHaveBeenCalledWith("openai-codex");
  });

  it("throws when pi auth missing", async () => {
    const getApiKey = vi.fn(async () => undefined);
    await expect(ensureProviderAuth({ getApiKey })).rejects.toThrow(
      "Missing pi auth for provider: openai-codex",
    );
  });
});
