import { exec } from "node:child_process";
import { stdin as input, stdout as output } from "node:process";
import { createInterface } from "node:readline/promises";

import type { AuthStorage } from "@mariozechner/pi-coding-agent";

import { fixedPiProvider } from "../../config/pi-config.js";

type AuthReader = Pick<AuthStorage, "getApiKey" | "login">;
const nodeBootstrapError = "OpenAI Codex OAuth is only available in Node.js environments";
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const isBootstrapError = (error: unknown) => error instanceof Error && error.message === nodeBootstrapError;

const openBrowser = (url: string) => {
  const command = process.platform === "darwin"
    ? `open "${url}"`
    : process.platform === "win32"
      ? `start "" "${url}"`
      : `xdg-open "${url}"`;
  exec(command, () => undefined);
};

const promptForInput = async (message: string, placeholder?: string, allowEmpty = false) => {
  const rl = createInterface({ input, output });
  try {
    for (;;) {
      const suffix = placeholder ? ` (${placeholder})` : "";
      const value = (await rl.question(`${message}${suffix} `)).trim();
      if (value || allowEmpty) return value;
      console.log("Input required.");
    }
  } finally {
    rl.close();
  }
};

export const ensureProviderAuth = async (authStorage: AuthReader) => {
  if (await authStorage.getApiKey(fixedPiProvider)) return;
  if (!input.isTTY || !output.isTTY) {
    throw new Error(`Missing pi auth for provider: ${fixedPiProvider}. Run pi and use /login, or start bot in interactive terminal for automatic browser login.`);
  }

  console.log(`Missing pi auth for provider: ${fixedPiProvider}. Starting browser login...`);
  await import("@mariozechner/pi-ai/oauth");
  const login = async () => {
    await authStorage.login(fixedPiProvider, {
      onAuth: ({ url, instructions }) => {
        console.log(instructions ?? "Open browser to complete login.");
        console.log(url);
        openBrowser(url);
      },
      onPrompt: (prompt) => promptForInput(prompt.message, prompt.placeholder, prompt.allowEmpty),
      onProgress: (message) => console.log(message),
    });
    if (await authStorage.getApiKey(fixedPiProvider)) return;
    throw new Error(`Pi auth completed but token unavailable for provider: ${fixedPiProvider}`);
  };

  try {
    await login();
  } catch (error) {
    if (!isBootstrapError(error)) throw error;
    await wait(50);
    try {
      await login();
    } catch (retryError) {
      if (!isBootstrapError(retryError)) throw retryError;
      await wait(150);
      await login();
    }
  }
};
