import { describe, expect, it } from "vitest";

import { sessionFileForScope } from "../src/integrations/pi/session-path";

describe("sessionFileForScope", () => {
  it("sanitizes scope ids into stable file names", () => {
    expect(sessionFileForScope("/tmp/sessions", "channel:123")).toBe("/tmp/sessions/channel_123.jsonl");
  });
});
