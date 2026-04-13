import { ApplicationCommandOptionType, Events, type ApplicationCommandDataResolvable } from "discord.js";

import { scopeIdOfChatTarget } from "../../features/chat/chat-scope.js";
import { formatResetMessage, formatSessionUsage, sessionReply } from "./session-command-format.js";
import type { ScopeSessionStats } from "../pi/session-stats.js";

type SessionCommandService = {
  getScopeStats(scopeId: string): ScopeSessionStats | undefined;
  resetScope(scopeId: string): Promise<unknown>;
};

type DiscordSessionCommandClient = {
  on(event: string, handler: (interaction: DiscordSessionInteraction) => Promise<void>): unknown;
};
type DiscordSlashCommandClient = {
  application?: { commands: { set(commands: readonly ApplicationCommandDataResolvable[]): Promise<unknown> } } | null;
};
type DiscordSessionInteraction = {
  isChatInputCommand(): boolean;
  commandName: string;
  user: { id: string };
  channelId: string;
  guildId: string | null;
  channel?: { isDMBased(): boolean } | null;
  options: { getSubcommand(): string };
  reply(options: { content: string; flags?: number }): Promise<unknown>;
};

export const discordSessionCommands = [
  {
    name: "session",
    description: "현재 Discord 세션 관리",
    dmPermission: true,
    options: [
      {
        type: ApplicationCommandOptionType.Subcommand,
        name: "reset",
        description: "현재 채널에서 내 세션 초기화",
      },
      {
        type: ApplicationCommandOptionType.Subcommand,
        name: "usage",
        description: "현재 채널에서 내 세션 토큰 사용량 보기",
      },
    ],
  },
] satisfies readonly ApplicationCommandDataResolvable[];

export const syncDiscordSessionCommands = async (client: DiscordSlashCommandClient) => {
  if (!client.application) throw new Error("Discord application unavailable");
  await client.application.commands.set(discordSessionCommands);
};

export const registerDiscordSessionHandlers = ({
  client,
  sessionService,
}: {
  client: DiscordSessionCommandClient;
  sessionService: SessionCommandService;
}) => {
  client.on(Events.InteractionCreate, async (interaction: DiscordSessionInteraction) => {
    if (!interaction.isChatInputCommand() || interaction.commandName !== "session") return;

    try {
      const isDirectMessage = interaction.channel?.isDMBased() ?? interaction.guildId == null;
      const scopeId = scopeIdOfChatTarget({
        authorId: interaction.user.id,
        channelId: interaction.channelId,
        isDirectMessage,
      });
      const subcommand = interaction.options.getSubcommand();

      if (subcommand === "usage") {
        await interaction.reply(
          sessionReply(
            formatSessionUsage(sessionService.getScopeStats(scopeId), isDirectMessage),
            interaction.guildId,
          ),
        );
        return;
      }

      if (subcommand === "reset") {
        await sessionService.resetScope(scopeId);
        await interaction.reply(sessionReply(formatResetMessage(isDirectMessage), interaction.guildId));
        return;
      }

      await interaction.reply(sessionReply(`에러: 지원하지 않는 세션 명령어 ${subcommand}`, interaction.guildId));
    } catch (error) {
      const text = error instanceof Error ? error.message : String(error);
      await interaction.reply(sessionReply(`에러: ${text}`, interaction.guildId)).catch(() => undefined);
    }
  });
};
