import { describe, expect, it } from "vitest";

import {
  schedulerRecurrences,
  schedulerToolActions,
} from "../src/features/scheduler/scheduler-types.js";

describe("scheduler type constants", () => {
  it("exports allowed recurrence and action values", () => {
    expect(schedulerRecurrences).toEqual(["once", "cron"]);
    expect(schedulerToolActions).toEqual(["add", "list", "cancel"]);
  });
});
