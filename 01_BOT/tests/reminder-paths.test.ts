import { describe, expect, it } from "vitest";

import { remindersDirectoryForCwd, remindersFileForCwd } from "../src/features/scheduler/reminder-paths.js";

describe("reminder paths", () => {
  it("resolves scheduler data paths from repo cwd", () => {
    expect(remindersDirectoryForCwd("/repo")).toBe("/repo/01_BOT/.data/scheduler");
    expect(remindersFileForCwd("/repo")).toBe("/repo/01_BOT/.data/scheduler/reminders.json");
  });
});
