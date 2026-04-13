import { describe, expect, it } from "vitest";

import { createRuntimeTools } from "../src/integrations/pi/runtime-tools.js";

describe("createRuntimeTools", () => {
  it("includes all built-in pi tools", () => {
    expect(createRuntimeTools(process.cwd()).map((tool: { name: string }) => tool.name)).toEqual([
      "read",
      "bash",
      "edit",
      "write",
      "grep",
      "find",
      "ls",
    ]);
  });
});
