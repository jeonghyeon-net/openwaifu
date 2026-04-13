import { describe, expect, it } from "vitest";

import {
  clearDiscordSessionContext,
  getDiscordSessionContext,
  registerDiscordSessionContext,
} from "../src/integrations/pi/discord-session-context.js";

describe("discord session context", () => {
  it("stores and retrieves session-scoped discord context", () => {
    registerDiscordSessionContext("/tmp/session.jsonl", "scope:1", {
      authorId: "user-1",
      channelId: "channel-1",
      guildId: "guild-1",
      isDirectMessage: false,
    });

    expect(getDiscordSessionContext("/tmp/session.jsonl")).toEqual({
      scopeId: "scope:1",
      discordContext: {
        authorId: "user-1",
        channelId: "channel-1",
        guildId: "guild-1",
        isDirectMessage: false,
      },
    });

    clearDiscordSessionContext("/tmp/session.jsonl");
    expect(getDiscordSessionContext("/tmp/session.jsonl")).toBeUndefined();
  });
});
