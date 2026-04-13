import type { AuthStorage } from "@mariozechner/pi-coding-agent";

import { fixedPiProvider } from "../../config/pi-config.js";

type AuthReader = Pick<AuthStorage, "getApiKey">;

export const ensureProviderAuth = async (authStorage: AuthReader) => {
  if (await authStorage.getApiKey(fixedPiProvider)) return;
  throw new Error(`Missing pi auth for provider: ${fixedPiProvider}. Run pi and use /login.`);
};
