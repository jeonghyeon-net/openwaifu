import { describe, expect, it } from "vitest";

import {
  createChatGptQuotaStatusService,
  loadMain,
  login,
  quotaServiceArgs,
  readyHandler,
  setCustomStatus,
  startChatGptQuotaStatusService,
  startSchedulerService,
  syncDiscordSessionCommands,
} from "./main-test-helpers.js";

describe("main ready flow", () => {
  it("updates status, syncs commands, starts services, and logs in", async () => {
    await loadMain();
    const quotaArgs = quotaServiceArgs();
    if (!quotaArgs) throw new Error("quota status service args missing");
    quotaArgs.onStatusText("5h 35% used · Weekly 62% used");
    quotaArgs.onError?.(new Error("boom"));
    quotaArgs.onError?.("oops");
    expect(setCustomStatus).toHaveBeenCalledWith("5h 35% used · Weekly 62% used");
    expect(createChatGptQuotaStatusService).toHaveBeenCalled();
    expect(quotaArgs.onError).toBeTypeOf("function");

    const onReady = readyHandler();
    if (!onReady) throw new Error("ready handler missing");
    const readyClient = { user: { tag: "bot#0001" } };
    onReady(readyClient);
    expect(syncDiscordSessionCommands).toHaveBeenCalledWith(readyClient);
    syncDiscordSessionCommands.mockRejectedValueOnce(new Error("sync fail"));
    onReady(readyClient);
    await Promise.resolve();
    expect(startSchedulerService).toHaveBeenCalled();
    expect(startChatGptQuotaStatusService).toHaveBeenCalled();
    expect(login).toHaveBeenCalledWith("token");
  });
});
