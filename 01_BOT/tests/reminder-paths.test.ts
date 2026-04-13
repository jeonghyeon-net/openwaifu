import { describe, expect, it } from "vitest";

import { schedulerDirectoryForCwd, schedulerFileForCwd } from "../src/features/scheduler/scheduler-paths.js";

describe("reminder paths", () => {
  it("resolves scheduler data paths from repo cwd", () => {
    expect(schedulerDirectoryForCwd("/repo")).toBe("/repo/01_BOT/.data/scheduler");
    expect(schedulerFileForCwd("/repo")).toBe("/repo/01_BOT/.data/scheduler/scheduled-tasks.json");
  });
});
