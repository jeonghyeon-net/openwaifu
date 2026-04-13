import type { Client } from "discord.js";

import type { DiscordAdminAccess } from "./discord-admin-access.js";
import { assertActorAboveMember, assertActorAboveRoles, requireAdminActor } from "./discord-admin-actor.js";
import { requireGuild, requireGuildMember } from "./discord-admin-helpers.js";
import type {
  DiscordToolContext,
  ModerateDiscordMemberInput,
  UpdateDiscordMemberRolesInput,
} from "./discord-admin-types.js";

export const updateDiscordMemberRoles = async (
  client: Client,
  context: DiscordToolContext,
  access: DiscordAdminAccess,
  input: UpdateDiscordMemberRolesInput,
) => {
  const guild = await requireGuild(client, context, access, input.guildId);
  const actor = await requireAdminActor(guild, context, access);
  const member = await requireGuildMember(guild, input.memberId);
  const roles = [...(await guild.roles.fetch()).values()].flatMap((role) => (role ? [role] : []));
  const targets = roles.filter((role) => [...(input.addRoleIds ?? []), ...(input.removeRoleIds ?? [])].includes(role.id));
  assertActorAboveMember(guild, actor, member);
  assertActorAboveRoles(guild, actor, targets);
  if (input.addRoleIds?.length) await member.roles.add(input.addRoleIds, input.reason);
  if (input.removeRoleIds?.length) await member.roles.remove(input.removeRoleIds, input.reason);
  return `Updated roles for member ${member.user.tag} (${member.id}) in guild ${guild.id}`;
};

export const moderateDiscordMember = async (
  client: Client,
  context: DiscordToolContext,
  access: DiscordAdminAccess,
  input: ModerateDiscordMemberInput,
) => {
  const guild = await requireGuild(client, context, access, input.guildId);
  const actor = await requireAdminActor(guild, context, access);
  const member = input.action === "ban" || input.action === "unban" ? null : await requireGuildMember(guild, input.memberId);
  if (member) assertActorAboveMember(guild, actor, member);
  if (input.action === "ban") {
    await guild.members.ban(input.memberId, { deleteMessageSeconds: input.deleteMessageSeconds, reason: input.reason });
  } else if (input.action === "unban") {
    await guild.bans.remove(input.memberId, input.reason);
  } else if (input.action === "timeout") {
    await member?.timeout((input.durationMinutes ?? 5) * 60_000, input.reason);
  } else if (input.action === "remove_timeout") {
    await member?.timeout(null, input.reason);
  } else if (input.action === "nickname") {
    await member?.setNickname(input.nickname ?? null, input.reason);
  } else if (input.action === "kick") {
    await member?.kick(input.reason);
  }
  return `Ran ${input.action} on member ${input.memberId} in guild ${guild.id}`;
};
