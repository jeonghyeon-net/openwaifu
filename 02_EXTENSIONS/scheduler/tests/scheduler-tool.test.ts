import { describe, expect, it } from "vitest";

import { createSchedulerTool } from "../src/tool.js";

describe("scheduler tool", () => {
  it("exposes metadata and delegates execution", async () => {
    const tool = createSchedulerTool();
    expect(tool.name).toBe("scheduler");
    expect(tool.label).toBe("Scheduler");
    expect(tool.promptGuidelines).toHaveLength(6);
    expect(tool.prepareArguments?.({ action: "add", message: "legacy" })).toEqual({ action: "add", message: "legacy", prompt: "legacy" });
    expect(tool.prepareArguments?.({ action: "add", prompt: "fresh" })).toEqual({ action: "add", prompt: "fresh" });
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
