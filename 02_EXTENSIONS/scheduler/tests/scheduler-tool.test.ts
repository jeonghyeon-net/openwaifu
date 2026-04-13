import { describe, expect, it } from "vitest";

import { createSchedulerTool } from "../src/tool.js";

describe("scheduler tool", () => {
  it("exposes metadata and delegates execution", async () => {
    const tool = createSchedulerTool();
    expect(tool.name).toBe("scheduler");
    expect(tool.label).toBe("Scheduler");
    expect(tool.promptGuidelines).toHaveLength(6);
    expect(tool.prepareArguments?.({ action: "add", message: "legacy" })).toEqual({ action: "add", prompt: "legacy" });
    expect(tool.prepareArguments?.({ action: "add", prompt: "fresh" })).toEqual({ action: "add", prompt: "fresh" });
    expect(tool.prepareArguments?.({ action: "add", recurrence: "daily", time: "09:15", message: "legacy daily" })).toEqual({
      action: "add",
      time: "09:15",
      cron: "15 09 * * *",
      prompt: "legacy daily",
    });
    expect(tool.prepareArguments?.({ action: "add", cron: "0 9 * * *", prompt: "cron task", mentionUser: false })).toEqual({
      action: "add",
      cron: "0 9 * * *",
      prompt: "cron task",
      mentionUser: false,
    });
    expect(tool.prepareArguments?.({ action: "add", time: "13:00", date: "2099-01-01", prompt: "dated task", id: "task-9" })).toEqual({
      action: "add",
      time: "13:00",
      date: "2099-01-01",
      prompt: "dated task",
      id: "task-9",
    });
    expect(tool.prepareArguments?.({ action: "cancel", id: "task-1" })).toEqual({ action: "cancel", id: "task-1" });
    expect(tool.prepareArguments?.({})).toEqual({ action: "list" });
    expect(tool.prepareArguments?.(undefined)).toBeUndefined();

    const result = await tool.execute?.(
      "tool-1",
      { action: "list" },
      undefined,
      undefined,
      {
        cwd: "/repo",
        sessionManager: { getSessionFile: () => undefined },
      } as import("@mariozechner/pi-coding-agent").ExtensionContext,
    );

    expect(result).toMatchObject({ details: { error: "Discord session context unavailable." } });
  });
});
