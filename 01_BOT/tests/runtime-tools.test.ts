import { describe, expect, it } from "vitest";

import { createRuntimeTools } from "../src/integrations/pi/runtime-tools";

describe("createRuntimeTools", () => {
  it("includes all built-in pi tools", () => {
    expect(createRuntimeTools(process.cwd()).map((tool) => tool.name)).toEqual([
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
