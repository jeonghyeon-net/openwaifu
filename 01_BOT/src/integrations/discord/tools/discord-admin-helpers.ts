import type { Client, Guild, GuildMember } from "discord.js";

import type { DiscordToolContext } from "./discord-admin-types.js";
import type { DiscordAdminAccess } from "./discord-admin-access.js";

export const formatBlock = (title: string, lines: string[]) =>
  [title, ...(lines.length ? lines : ["- none"])].join("\n");

export const requireGuild = async (
  client: Client,
  context: DiscordToolContext,
  access: DiscordAdminAccess,
  guildId?: string,
): Promise<Guild> => {
  const targetGuildId = guildId ?? access.scopeGuildId ?? context.guildId;
  if (!targetGuildId) throw new Error("guild_id required outside guild message context");
  if (access.scopeGuildId && targetGuildId !== access.scopeGuildId) {
    throw new Error(`Guild out of scope for current session: ${targetGuildId}`);
  }
  return client.guilds.fetch(targetGuildId).catch(() => {
    throw new Error(`Guild not found: ${targetGuildId}`);
  });
};

export const requireGuildMember = async (guild: Guild, memberId: string): Promise<GuildMember> =>
  guild.members.fetch(memberId).catch(() => {
    throw new Error(`Member not found in guild ${guild.id}: ${memberId}`);
  });

export const requireSendableChannel = async (
  client: Client,
  access: DiscordAdminAccess,
  channelId: string,
) => {
  const channel = await client.channels.fetch(channelId);
  if (!channel?.isTextBased() || !("send" in channel)) throw new Error(`Channel not sendable: ${channelId}`);
  if (access.scopeGuildId && "guildId" in channel && channel.guildId !== access.scopeGuildId) {
    throw new Error(`Channel out of scope for current session: ${channelId}`);
  }
  return channel;
};

export const requireGuildChannel = async (client: Client, access: DiscordAdminAccess, channelId: string) => {
  const channel = await client.channels.fetch(channelId);
  if (!channel || channel.isDMBased() || !("delete" in channel)) {
    throw new Error(`Guild channel not found: ${channelId}`);
  }
  if (access.scopeGuildId && channel.guildId !== access.scopeGuildId) {
    throw new Error(`Channel out of scope for current session: ${channelId}`);
  }
  return channel;
};
