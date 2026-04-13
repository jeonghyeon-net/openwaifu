import { MessageFlags } from "discord.js";
import { describe, expect, it } from "vitest";

import {
  createSessionCommandEnv,
  discordInteraction,
} from "./discord-session-command-test-helpers.js";

describe("discord session command reset", () => {
  it("resets current guild scope and replies ephemerally", async () => {
    const { sessionService, run } = createSessionCommandEnv();
    const interaction = discordInteraction({ options: { getSubcommand: () => "reset" } });

    await run(interaction);

    expect(sessionService.resetScope).toHaveBeenCalledWith("channel:c:user:u");
    expect(interaction.reply).toHaveBeenCalledWith({
      content: "현재 채널에서 내 세션 초기화 완료. 다음 메시지부터 새 세션 시작.",
      flags: MessageFlags.Ephemeral,
    });
  });

  it("uses guildId fallback when interaction channel metadata is unavailable", async () => {
    const { sessionService, run } = createSessionCommandEnv();
    const interaction = discordInteraction({
      guildId: null,
      channel: undefined,
      options: { getSubcommand: () => "reset" },
    });

    await run(interaction);

    expect(sessionService.resetScope).toHaveBeenCalledWith("dm:u");
    expect(interaction.reply).toHaveBeenCalledWith({
      content: "현재 DM 세션 초기화 완료. 다음 메시지부터 새 세션 시작.",
    });
  });

  it("resets current dm scope and replies without ephemeral flag", async () => {
    const { sessionService, run } = createSessionCommandEnv();
    const interaction = discordInteraction({
      guildId: null,
      channel: { isDMBased: () => true },
      options: { getSubcommand: () => "reset" },
    });

    await run(interaction);

    expect(sessionService.resetScope).toHaveBeenCalledWith("dm:u");
    expect(interaction.reply).toHaveBeenCalledWith({
      content: "현재 DM 세션 초기화 완료. 다음 메시지부터 새 세션 시작.",
    });
  });

  it("returns error for unsupported subcommands", async () => {
    const { run } = createSessionCommandEnv();
    const interaction = discordInteraction({ options: { getSubcommand: () => "other" } });

    await run(interaction);

    expect(interaction.reply).toHaveBeenCalledWith({
      content: "에러: 지원하지 않는 세션 명령어 other",
      flags: MessageFlags.Ephemeral,
    });
  });
});
