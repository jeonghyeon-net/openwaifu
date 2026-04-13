import { ChannelType, type Client } from "discord.js";

import type { DiscordAdminAccess } from "./discord-admin-access.js";
import { requireAdminActor } from "./discord-admin-actor.js";
import {
  requireGuild,
  requireGuildChannel,
  requireSendableChannel,
} from "./discord-admin-helpers.js";
import type {
  CreateDiscordChannelInput,
  DeleteDiscordChannelInput,
  DiscordToolContext,
  SendDiscordMessageInput,
  UpdateDiscordChannelInput,
} from "./discord-admin-types.js";

const channelTypeOf = (type: CreateDiscordChannelInput["type"]) => {
  if (type === "announcement") return ChannelType.GuildAnnouncement;
  if (type === "forum") return ChannelType.GuildForum;
  if (type === "voice") return ChannelType.GuildVoice;
  return ChannelType.GuildText;
};

export const sendDiscordMessage = async (
  client: Client,
  context: DiscordToolContext,
  access: DiscordAdminAccess,
  input: SendDiscordMessageInput,
) => {
  const targetGuild = context.guildId ? await client.guilds.fetch(context.guildId) : null;
  if (targetGuild) await requireAdminActor(targetGuild, context, access);
  const channel = await requireSendableChannel(client, access, input.channelId ?? context.channelId);
  const message = await channel.send(input.content);
  return `Sent message ${message.id} to channel ${channel.id}`;
};

export const createDiscordChannel = async (
  client: Client,
  context: DiscordToolContext,
  access: DiscordAdminAccess,
  input: CreateDiscordChannelInput,
) => {
  const guild = await requireGuild(client, context, access, input.guildId);
  await requireAdminActor(guild, context, access);
  const channel = await guild.channels.create({
    name: input.name,
    parent: input.categoryId,
    topic: input.topic,
    type: channelTypeOf(input.type),
  });
  return `Created channel ${channel.name} (${channel.id}) in guild ${guild.id}`;
};

export const updateDiscordChannel = async (
  client: Client,
  context: DiscordToolContext,
  access: DiscordAdminAccess,
  input: UpdateDiscordChannelInput,
) => {
  const channel = await requireGuildChannel(client, access, input.channelId);
  await requireAdminActor(await client.guilds.fetch(channel.guildId), context, access);
  if (input.name) await channel.edit({ name: input.name, reason: input.reason });
  if (input.categoryId !== undefined && "setParent" in channel) {
    await channel.setParent(input.categoryId || null, { reason: input.reason });
  }
  if (input.topic !== undefined) {
    if (channel.type === ChannelType.GuildText || channel.type === ChannelType.GuildAnnouncement) {
      await channel.setTopic(input.topic || null, input.reason);
    } else if (channel.type === ChannelType.GuildForum) {
      await channel.setTopic(input.topic || null, input.reason);
    } else {
      throw new Error(`Channel does not support topic: ${channel.id}`);
    }
  }
  return `Updated channel ${channel.name} (${channel.id}) type=${ChannelType[channel.type]}`;
};

export const deleteDiscordChannel = async (
  client: Client,
  context: DiscordToolContext,
  access: DiscordAdminAccess,
  input: DeleteDiscordChannelInput,
) => {
  const channel = await requireGuildChannel(client, access, input.channelId);
  await requireAdminActor(await client.guilds.fetch(channel.guildId), context, access);
  await channel.delete(input.reason);
  return `Deleted channel ${channel.name} (${input.channelId})`;
};
