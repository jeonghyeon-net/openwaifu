import type { DiscordToolContext } from "./discord-admin-types.js";

export const discordContextPrompt = (context: DiscordToolContext) =>
  [
    "Current Discord context:",
    `- source: ${context.isDirectMessage ? "dm" : "guild"}`,
    `- current_guild_id: ${context.guildId ?? "none"}`,
    `- current_channel_id: ${context.channelId}`,
    `- current_author_id: ${context.authorId}`,
  ].join("\n");
