import { PermissionFlagsBits } from "discord.js";

import type { DiscordAdminClient, DiscordToolContext } from "./discord-admin-types.js";

export const canUseDiscordManagementTools = async (
  client: DiscordAdminClient,
  context: DiscordToolContext,
) => {
  if (context.isDirectMessage || !context.guildId) return false;
  try {
    const guild = await client.guilds.fetch(context.guildId);
    const member = await guild.members.fetch(context.authorId);
    return member.permissions.has(PermissionFlagsBits.Administrator);
  } catch {
    return false;
  }
};
