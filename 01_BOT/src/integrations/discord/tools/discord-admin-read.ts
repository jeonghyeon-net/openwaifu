import { ChannelType, type Client } from "discord.js";

import type { DiscordAdminAccess } from "./discord-admin-access.js";
import { requireAdminActor } from "./discord-admin-actor.js";
import { formatBlock, requireGuild } from "./discord-admin-helpers.js";
import type { DiscordToolContext, InspectDiscordServerInput } from "./discord-admin-types.js";

export const listDiscordServers = async (
  client: Client,
  context: DiscordToolContext,
  access: DiscordAdminAccess,
) => {
  if (access.scopeGuildId) {
    const guild = await client.guilds.fetch(access.scopeGuildId);
    await requireAdminActor(guild, context, access);
    return formatBlock("Discord servers", [`- ${guild.name} (${guild.id}) [current]`]);
  }
  const guilds = await client.guilds.fetch();
  const lines = [...guilds.values()].map(
    (guild) => `- ${guild.name} (${guild.id})${guild.id === context.guildId ? " [current]" : ""}`,
  );
  return formatBlock("Discord servers", lines);
};

export const inspectDiscordServer = async (
  client: Client,
  context: DiscordToolContext,
  access: DiscordAdminAccess,
  input: InspectDiscordServerInput,
) => {
  const guild = await requireGuild(client, context, access, input.guildId);
  await requireAdminActor(guild, context, access);
  if (input.view === "summary") {
    const [channels, roles] = await Promise.all([guild.channels.fetch(), guild.roles.fetch()]);
    return formatBlock(`Discord server ${guild.name} (${guild.id})`, [
      `- members: ${guild.memberCount}`,
      `- channels: ${channels.filter(Boolean).size}`,
      `- roles: ${roles.filter(Boolean).size}`,
    ]);
  }
  if (input.view === "channels") {
    const channels = [...(await guild.channels.fetch()).values()].flatMap((channel) => (channel ? [channel] : []));
    const lines = channels
      .sort((left, right) => left.rawPosition - right.rawPosition)
      .map((channel) => `- ${channel.name} (${channel.id}) type=${ChannelType[channel.type]}`);
    return formatBlock(`Channels in ${guild.name}`, lines);
  }
  if (input.view === "roles") {
    const roles = [...(await guild.roles.fetch()).values()].flatMap((role) => (role ? [role] : []));
    const lines = roles
      .sort((left, right) => right.position - left.position)
      .map((role) => `- ${role.name} (${role.id}) mentionable=${role.mentionable}`);
    return formatBlock(`Roles in ${guild.name}`, lines);
  }
  const members = await guild.members.fetch({ limit: input.limit ?? 20 });
  const lines = [...members.values()].map((member) => {
    const roles = member.roles.cache.filter((role) => role.name !== "@everyone");
    return `- ${member.user.tag} (${member.id}) roles=${roles.map((role) => role.name).join(", ") || "none"}`;
  });
  return formatBlock(`Members in ${guild.name}`, lines);
};
