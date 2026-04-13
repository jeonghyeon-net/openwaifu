import { describe, expect, it } from "vitest";

import { noop } from "../src/noop";

describe("noop", () => {
  it("returns noop", () => {
    expect(noop()).toBe("noop");
  });
});
