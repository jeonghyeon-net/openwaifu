import type { AuthStorage } from "@mariozechner/pi-coding-agent";

type AuthReader = Pick<AuthStorage, "getApiKey">;

export const ensureProviderAuth = async (authStorage: AuthReader, provider: string) => {
  if (await authStorage.getApiKey(provider)) return;
  throw new Error(`Missing auth for provider: ${provider}`);
};
