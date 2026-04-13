import type { Guild, GuildMember } from "discord.js";

import type { DiscordAdminClient, DiscordToolContext } from "./discord-admin-types.js";

export const formatBlock = (title: string, lines: string[]) =>
  [title, ...(lines.length ? lines : ["- none"])].join("\n");

const requireContextGuildId = (context: DiscordToolContext) => {
  if (!context.guildId || context.isDirectMessage) throw new Error("Discord admin tools require current guild context");
  return context.guildId;
};

export const requireGuild = async (
  client: DiscordAdminClient,
  context: DiscordToolContext,
  guildId?: string,
): Promise<Guild> => {
  const currentGuildId = requireContextGuildId(context);
  const targetGuildId = guildId ?? currentGuildId;
  if (targetGuildId !== currentGuildId) throw new Error(`Guild out of scope: ${targetGuildId}`);
  return client.guilds.fetch(targetGuildId).catch(() => {
    throw new Error(`Guild not found: ${targetGuildId}`);
  });
};

export const requireGuildMember = async (guild: Guild, memberId: string): Promise<GuildMember> =>
  guild.members.fetch(memberId).catch(() => {
    throw new Error(`Member not found in guild ${guild.id}: ${memberId}`);
  });

export const requireSendableChannel = async (client: DiscordAdminClient, context: DiscordToolContext, channelId: string) => {
  const channel = await client.channels.fetch(channelId);
  const currentGuildId = requireContextGuildId(context);
  if (!channel?.isTextBased() || !("send" in channel) || !("guildId" in channel) || channel.guildId !== currentGuildId) {
    throw new Error(`Channel not sendable: ${channelId}`);
  }
  return channel;
};

export const requireGuildChannel = async (client: DiscordAdminClient, context: DiscordToolContext, channelId: string) => {
  const channel = await client.channels.fetch(channelId);
  const currentGuildId = requireContextGuildId(context);
  if (!channel || channel.isDMBased() || !("delete" in channel) || channel.guildId !== currentGuildId) {
    throw new Error(`Guild channel not found: ${channelId}`);
  }
  return channel;
};
