import type { DiscordToolContext } from "./discord-admin-types.js";

export const discordContextPrompt = (context: DiscordToolContext) =>
  [
    "Current Discord context:",
    `- source: ${context.isDirectMessage ? "dm" : "guild"}`,
    `- current_guild_id: ${context.guildId ?? "none"}`,
    context.guildName ? `- current_guild_name: ${context.guildName}` : null,
    `- current_channel_id: ${context.channelId}`,
    context.channelName ? `- current_channel_name: ${context.channelName}` : null,
    `- current_author_id: ${context.authorId}`,
  ]
    .filter((line): line is string => line !== null)
    .join("\n");
