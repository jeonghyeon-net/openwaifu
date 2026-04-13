import { describe, expect, it } from "vitest";

import { createSchedulerTool } from "../src/tool.js";

describe("scheduler tool", () => {
  it("exposes metadata and delegates execution", async () => {
    const tool = createSchedulerTool();
    expect(tool.name).toBe("scheduler");
    expect(tool.label).toBe("Scheduler");
    expect(tool.promptGuidelines).toHaveLength(4);

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
