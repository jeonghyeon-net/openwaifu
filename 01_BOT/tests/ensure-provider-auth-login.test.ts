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
  exec.mockClear();
  createInterface.mockReset();
  log.mockClear();
});
afterEach(() => {
  if (stdinTTY) Object.defineProperty(process.stdin, "isTTY", stdinTTY);
  if (stdoutTTY) Object.defineProperty(process.stdout, "isTTY", stdoutTTY);
  if (platform) Object.defineProperty(process, "platform", platform);
});

describe("ensureProviderAuth login", () => {
  it("returns when pi auth exists", async () => {
    const getApiKey = vi.fn(async () => "token");
    const login = vi.fn(async () => undefined);
    await expect(ensureProviderAuth({ getApiKey, login })).resolves.toBeUndefined();
    expect(getApiKey).toHaveBeenCalledWith("openai-codex");
    expect(login).not.toHaveBeenCalled();
  });

  it("opens browser, prompts for code, and retries on macOS", async () => {
    setPlatform("darwin");
    createInterface.mockReturnValue({ question: vi.fn().mockResolvedValueOnce("").mockResolvedValueOnce(" pasted-code "), close: vi.fn() });
    const getApiKey = vi.fn<() => Promise<string | undefined>>().mockResolvedValueOnce(undefined).mockResolvedValueOnce("token");
    const login = vi.fn(async (_provider: string, callbacks: any) => {
      callbacks.onAuth({ url: "https://auth.example" });
      callbacks.onProgress?.("waiting");
      await expect(callbacks.onPrompt({ message: "Paste code", placeholder: "url" })).resolves.toBe("pasted-code");
    });

    await expect(ensureProviderAuth({ getApiKey, login })).resolves.toBeUndefined();
    expect(exec).toHaveBeenCalledWith('open "https://auth.example"', expect.any(Function));
    expect(log).toHaveBeenCalledWith("Input required.");
    expect(log).toHaveBeenCalledWith("Open browser to complete login.");
    expect(log).toHaveBeenCalledWith("waiting");
  });

  it("supports blank input when provider allows empty and uses Windows command", async () => {
    setPlatform("win32");
    createInterface.mockReturnValue({ question: vi.fn().mockResolvedValueOnce(""), close: vi.fn() });
    const getApiKey = vi.fn<() => Promise<string | undefined>>().mockResolvedValueOnce(undefined).mockResolvedValueOnce("token");
    const login = vi.fn(async (_provider: string, callbacks: any) => {
      callbacks.onAuth({ url: "https://auth.example", instructions: "Do login" });
      await expect(callbacks.onPrompt({ message: "Optional input", allowEmpty: true })).resolves.toBe("");
    });

    await expect(ensureProviderAuth({ getApiKey, login })).resolves.toBeUndefined();
    expect(exec).toHaveBeenCalledWith('start "" "https://auth.example"', expect.any(Function));
    expect(log).toHaveBeenCalledWith("Do login");
  });
});
