import { ChannelType, type ForumChannel, type NewsChannel, type TextChannel } from "discord.js";

import {
  requireGuild,
  requireGuildChannel,
  requireSendableChannel,
} from "./discord-admin-helpers.js";
import type {
  CreateDiscordChannelInput,
  DeleteDiscordChannelInput,
  DiscordAdminClient,
  DiscordToolContext,
  SendDiscordMessageInput,
  UpdateDiscordChannelInput,
} from "./discord-admin-types.js";

type TopicChannel = ForumChannel | NewsChannel | TextChannel;
const channelTypeOf = (type: CreateDiscordChannelInput["type"]) => {
  if (type === "announcement") return ChannelType.GuildAnnouncement;
  if (type === "forum") return ChannelType.GuildForum;
  if (type === "voice") return ChannelType.GuildVoice;
  return ChannelType.GuildText;
};
const topicChannelTypes = new Set([ChannelType.GuildAnnouncement, ChannelType.GuildForum, ChannelType.GuildText]);
const canSetTopic = (channel: Awaited<ReturnType<typeof requireGuildChannel>>): channel is TopicChannel =>
  "setTopic" in channel && topicChannelTypes.has(channel.type);

export const sendDiscordMessage = async (
  client: DiscordAdminClient,
  context: DiscordToolContext,
  input: SendDiscordMessageInput,
) => {
  const channel = await requireSendableChannel(client, context, input.channelId ?? context.channelId);
  const message = await channel.send(input.content);
  return `Sent message ${message.id} to channel ${channel.id}`;
};

export const createDiscordChannel = async (
  client: DiscordAdminClient,
  context: DiscordToolContext,
  input: CreateDiscordChannelInput,
) => {
  const guild = await requireGuild(client, context, input.guildId);
  const channel = await guild.channels.create({
    name: input.name,
    parent: input.categoryId,
    topic: input.topic,
    type: channelTypeOf(input.type),
  });
  return `Created channel ${channel.name} (${channel.id}) in guild ${guild.id}`;
};

export const updateDiscordChannel = async (
  client: DiscordAdminClient,
  context: DiscordToolContext,
  input: UpdateDiscordChannelInput,
) => {
  const channel = await requireGuildChannel(client, context, input.channelId);
  if (input.name) await channel.edit({ name: input.name, reason: input.reason });
  if (input.categoryId !== undefined && "setParent" in channel) {
    await channel.setParent(input.categoryId || null, { reason: input.reason });
  }
  if (input.topic !== undefined) {
    if (!canSetTopic(channel)) throw new Error(`Channel does not support topic: ${channel.id}`);
    await channel.setTopic(input.topic || null, input.reason);
  }
  return `Updated channel ${channel.name} (${channel.id}) type=${ChannelType[channel.type]}`;
};

export const deleteDiscordChannel = async (
  client: DiscordAdminClient,
  context: DiscordToolContext,
  input: DeleteDiscordChannelInput,
) => {
  const channel = await requireGuildChannel(client, context, input.channelId);
  const name = channel.name;
  await channel.delete(input.reason);
  return `Deleted channel ${name} (${input.channelId})`;
};
