import { PermissionFlagsBits, type Client } from "discord.js";

import type { DiscordToolContext } from "./discord-admin-types.js";

export type DiscordAdminAccess = {
  enabled: boolean;
  scopeGuildId?: string;
};

export const loadDiscordAdminAccess = async (
  client: Client,
  context: DiscordToolContext,
  adminUserIds: string[],
): Promise<DiscordAdminAccess> => {
  if (adminUserIds.includes(context.authorId)) return { enabled: true };
  if (!context.guildId) return { enabled: false };

  const guild = await client.guilds.fetch(context.guildId).catch(() => null);
  const member = guild ? await guild.members.fetch(context.authorId).catch(() => null) : null;
  if (member?.permissions.has(PermissionFlagsBits.Administrator)) {
    return { enabled: true, scopeGuildId: context.guildId };
  }
  return { enabled: false, scopeGuildId: context.guildId };
};
