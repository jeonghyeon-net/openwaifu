import { describe, expect, it } from "vitest";

import { sessionFileForScope, sessionFileForScheduledRun } from "../src/integrations/pi/session-path.js";

describe("session path helpers", () => {
  it("sanitizes scope ids into stable file names", () => {
    expect(sessionFileForScope("/tmp/sessions", "channel:123")).toBe("/tmp/sessions/channel_123.jsonl");
  });

  it("builds fresh scheduled-run session file paths", () => {
    expect(sessionFileForScheduledRun("/tmp/sessions", "channel:123:user:abc", "task:1", "2026-04-13T00:01:02.000Z")).toBe(
      "/tmp/sessions/scheduled__channel_123_user_abc__task_1__2026-04-13T00_01_02.000Z.jsonl",
    );
  });
});
