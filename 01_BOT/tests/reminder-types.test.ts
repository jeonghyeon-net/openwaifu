import { describe, expect, it } from "vitest";

import {
  reminderRecurrences,
  reminderToolActions,
} from "../src/features/scheduler/reminder-types.js";

describe("reminder type constants", () => {
  it("exports allowed recurrence and action values", () => {
    expect(reminderRecurrences).toEqual(["once", "daily"]);
    expect(reminderToolActions).toEqual(["add", "list", "cancel"]);
  });
});
