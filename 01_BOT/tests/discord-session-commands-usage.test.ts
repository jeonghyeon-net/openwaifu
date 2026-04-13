import { MessageFlags } from "discord.js";
import { describe, expect, it } from "vitest";

import {
  createSessionCommandEnv,
  discordInteraction,
} from "./discord-session-command-test-helpers.js";

describe("discord session command usage", () => {
  it("reports cumulative usage for current guild scope with ephemeral reply", async () => {
    const { sessionService, run } = createSessionCommandEnv();
    sessionService.getScopeStats.mockReturnValue({
      sessionFile: "/tmp/session.jsonl",
      sessionId: "session-1",
      userMessages: 2,
      assistantMessages: 3,
      toolCalls: 1,
      toolResults: 1,
      totalMessages: 6,
      tokens: { input: 1500, output: 40, cacheRead: 1, cacheWrite: 1, total: 1542 },
      cost: 0.123,
    });
    const interaction = discordInteraction();

    await run(interaction);

    expect(sessionService.getScopeStats).toHaveBeenCalledWith("channel:c:user:u");
    expect(interaction.reply).toHaveBeenCalledWith({
      content: [
        "현재 채널에서 내 세션 사용량",
        "메시지: user 2, assistant 3, toolResult 1",
        "도구 호출: 1",
        "누적 토큰: input 1,500, output 40, cache read 1, cache write 1, total 1,542",
        "누적 비용: $0.123",
      ].join("\n"),
      flags: MessageFlags.Ephemeral,
    });
  });

  it("reports empty usage when current scope has no session yet", async () => {
    const { sessionService, run } = createSessionCommandEnv();
    sessionService.getScopeStats.mockReturnValue(undefined);
    const interaction = discordInteraction({ guildId: null, channel: { isDMBased: () => true } });

    await run(interaction);

    expect(interaction.reply).toHaveBeenCalledWith({
      content: "현재 DM 세션 기록 없음. 아직 누적 토큰 없음.",
    });
  });

  it("reports handler failures back to Discord", async () => {
    const { sessionService, run } = createSessionCommandEnv();
    sessionService.getScopeStats.mockImplementation(() => {
      throw new Error("boom");
    });
    const interaction = discordInteraction();

    await run(interaction);

    expect(interaction.reply).toHaveBeenCalledWith({
      content: "에러: boom",
      flags: MessageFlags.Ephemeral,
    });
  });

  it("stringifies non-Error failures", async () => {
    const { sessionService, run } = createSessionCommandEnv();
    sessionService.getScopeStats.mockImplementation(() => {
      throw "boom";
    });
    const interaction = discordInteraction();

    await run(interaction);

    expect(interaction.reply).toHaveBeenCalledWith({
      content: "에러: boom",
      flags: MessageFlags.Ephemeral,
    });
  });
});
