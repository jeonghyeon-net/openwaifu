import { describe, expect, it } from "vitest";

import { extractChatGptCoreUsage, extractChatGptQuotaWindows, formatChatGptQuotaStatus } from "../src/features/chatgpt-quota/chatgpt-quota-service.js";
import { createWindow, fixedNow } from "./chatgpt-quota-test-helpers.js";

describe("chatgpt quota windows", () => {
  it("formats status text and extracts mixed quota windows", () => {
    expect(formatChatGptQuotaStatus(35, 62)).toBe("5h 35% used · Weekly 62% used");
    expect(formatChatGptQuotaStatus(35, null)).toBe("5h 35% used · Weekly n/a");
    expect(extractChatGptQuotaWindows({
      rate_limit: { primary_window: { used_percent: 24.4, reset_after_seconds: 3600 } },
      codeReviewRateLimit: { secondaryWindow: { usedPercent: 62.6 } },
    }, fixedNow)).toEqual([
      { label: "Primary", usedPercent: 24, remainingPercent: 76, resetAfterSeconds: 3600, resetAt: "2026-04-13T13:00:00.000Z" },
      { label: "Code Review (Secondary)", usedPercent: 63, remainingPercent: 37, resetAfterSeconds: null, resetAt: null },
    ]);
  });

  it("accepts camel fields and defaults empty windows", () => {
    expect(extractChatGptQuotaWindows({ rateLimit: { primaryWindow: { usedPercent: 12 } } }).map((window) => ({ label: window.label, usedPercent: window.usedPercent }))).toEqual([{ label: "Primary", usedPercent: 12 }]);
    expect(extractChatGptQuotaWindows({ rateLimit: { primaryWindow: {} } }, fixedNow)[0]).toEqual({
      label: "Primary",
      usedPercent: 0,
      remainingPercent: 100,
      resetAfterSeconds: null,
      resetAt: null,
    });
  });

  it("derives five-hour and weekly windows from labels or reset length", () => {
    expect(extractChatGptCoreUsage([
      createWindow({ label: "Primary", usedPercent: 20, remainingPercent: 80, resetAfterSeconds: 300, resetAt: "2026-04-13T12:05:00.000Z" }),
      createWindow({ label: "Secondary", usedPercent: 60, remainingPercent: 40, resetAfterSeconds: 7200, resetAt: "2026-04-13T14:00:00.000Z" }),
      createWindow({ label: "Code Review (Primary)", usedPercent: 90, remainingPercent: 10 }),
    ])).toEqual({ fiveHour: createWindow({ label: "Primary", usedPercent: 20, remainingPercent: 80, resetAfterSeconds: 300, resetAt: "2026-04-13T12:05:00.000Z" }), weekly: createWindow({ label: "Secondary", usedPercent: 60, remainingPercent: 40, resetAfterSeconds: 7200, resetAt: "2026-04-13T14:00:00.000Z" }) });
    expect(extractChatGptCoreUsage([
      createWindow({ label: "Window A", usedPercent: 10, remainingPercent: 90, resetAfterSeconds: 60, resetAt: "2026-04-13T12:01:00.000Z" }),
      createWindow({ label: "Window B", usedPercent: 55, remainingPercent: 45, resetAfterSeconds: 604800, resetAt: "2026-04-20T12:00:00.000Z" }),
    ])).toEqual({ fiveHour: createWindow({ label: "Window A", usedPercent: 10, remainingPercent: 90, resetAfterSeconds: 60, resetAt: "2026-04-13T12:01:00.000Z" }), weekly: createWindow({ label: "Window B", usedPercent: 55, remainingPercent: 45, resetAfterSeconds: 604800, resetAt: "2026-04-20T12:00:00.000Z" }) });
    expect(extractChatGptCoreUsage([
      createWindow({ label: "Window A", usedPercent: 10, remainingPercent: 90, resetAfterSeconds: 500, resetAt: "2026-04-13T12:08:20.000Z" }),
      createWindow({ label: "Window B", usedPercent: 25, remainingPercent: 75, resetAfterSeconds: 100, resetAt: "2026-04-13T12:01:40.000Z" }),
    ])).toEqual({ fiveHour: createWindow({ label: "Window B", usedPercent: 25, remainingPercent: 75, resetAfterSeconds: 100, resetAt: "2026-04-13T12:01:40.000Z" }), weekly: createWindow({ label: "Window A", usedPercent: 10, remainingPercent: 90, resetAfterSeconds: 500, resetAt: "2026-04-13T12:08:20.000Z" }) });
  });

  it("omits duplicated or missing weekly windows and ignores code review only data", () => {
    expect(extractChatGptCoreUsage([createWindow({ label: "Primary", resetAfterSeconds: 60, resetAt: "2026-04-13T12:01:00.000Z" })])).toEqual({ fiveHour: createWindow({ label: "Primary", resetAfterSeconds: 60, resetAt: "2026-04-13T12:01:00.000Z" }), weekly: null });
    expect(extractChatGptCoreUsage([createWindow({ label: "Window A", resetAfterSeconds: 60, resetAt: "2026-04-13T12:01:00.000Z" }), createWindow({ label: "Window A", resetAfterSeconds: 60, resetAt: "2026-04-13T12:01:00.000Z" })])).toEqual({ fiveHour: createWindow({ label: "Window A", resetAfterSeconds: 60, resetAt: "2026-04-13T12:01:00.000Z" }), weekly: null });
    expect(extractChatGptCoreUsage([createWindow({ label: "Window A", resetAfterSeconds: 60, resetAt: "2026-04-13T12:01:00.000Z" }), createWindow({ label: "Window B", resetAfterSeconds: null, resetAt: null })])).toEqual({ fiveHour: createWindow({ label: "Window A", resetAfterSeconds: 60, resetAt: "2026-04-13T12:01:00.000Z" }), weekly: null });
    expect(extractChatGptCoreUsage([createWindow({ label: "Window A", resetAfterSeconds: null, resetAt: null }), createWindow({ label: "Window B", resetAfterSeconds: 60, resetAt: "2026-04-13T12:01:00.000Z" })])).toEqual({ fiveHour: createWindow({ label: "Window B", resetAfterSeconds: 60, resetAt: "2026-04-13T12:01:00.000Z" }), weekly: null });
    expect(extractChatGptCoreUsage([createWindow({ label: "Code Review (Primary)" })])).toEqual({ fiveHour: null, weekly: null });
  });
});
