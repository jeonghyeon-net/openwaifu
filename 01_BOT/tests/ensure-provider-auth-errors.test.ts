import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { exec, createInterface } = vi.hoisted(() => ({
  exec: vi.fn<(command: string, callback?: () => void) => void>((_command, callback) => callback?.()),
  createInterface: vi.fn(),
}));
vi.mock("node:child_process", () => ({ exec }));
vi.mock("node:readline/promises", () => ({ createInterface }));

import { ensureProviderAuth } from "../src/integrations/pi/ensure-provider-auth.js";

const stdinTTY = Object.getOwnPropertyDescriptor(process.stdin, "isTTY");
const stdoutTTY = Object.getOwnPropertyDescriptor(process.stdout, "isTTY");
const platform = Object.getOwnPropertyDescriptor(process, "platform");
const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
const setInteractive = (value: boolean) => {
  Object.defineProperty(process.stdin, "isTTY", { configurable: true, value });
  Object.defineProperty(process.stdout, "isTTY", { configurable: true, value });
};
const setPlatform = (value: NodeJS.Platform) => Object.defineProperty(process, "platform", { configurable: true, value });

beforeEach(() => {
  setInteractive(true);
  setPlatform("linux");
  exec.mockClear();
  createInterface.mockReset();
  log.mockClear();
});
afterEach(() => {
  if (stdinTTY) Object.defineProperty(process.stdin, "isTTY", stdinTTY);
  if (stdoutTTY) Object.defineProperty(process.stdout, "isTTY", stdoutTTY);
  if (platform) Object.defineProperty(process, "platform", platform);
});

describe("ensureProviderAuth errors", () => {
  it("uses xdg-open on linux and throws if token still missing after login", async () => {
    const getApiKey = vi.fn(async () => undefined);
    const login = vi.fn(async (_provider: string, callbacks: any) => {
      callbacks.onAuth({ url: "https://auth.example", instructions: "Do login" });
    });

    await expect(ensureProviderAuth({ getApiKey, login })).rejects.toThrow(
      "Pi auth completed but token unavailable for provider: openai-codex",
    );
    expect(exec).toHaveBeenCalledWith('xdg-open "https://auth.example"', expect.any(Function));
  });

  it("throws when auth missing in non-interactive terminal", async () => {
    setInteractive(false);
    const getApiKey = vi.fn(async () => undefined);
    const login = vi.fn(async () => undefined);

    await expect(ensureProviderAuth({ getApiKey, login })).rejects.toThrow(
      "Missing pi auth for provider: openai-codex. Run pi and use /login, or start bot in interactive terminal for automatic browser login.",
    );
    expect(login).not.toHaveBeenCalled();
  });
});
