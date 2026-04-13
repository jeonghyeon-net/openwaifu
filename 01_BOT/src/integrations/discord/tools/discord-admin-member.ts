import { requireGuild, requireGuildMember } from "./discord-admin-helpers.js";
import type {
  DiscordAdminClient,
  DiscordToolContext,
  ModerateDiscordMemberInput,
  UpdateDiscordMemberRolesInput,
} from "./discord-admin-types.js";

export const updateDiscordMemberRoles = async (
  client: DiscordAdminClient,
  context: DiscordToolContext,
  input: UpdateDiscordMemberRolesInput,
) => {
  const guild = await requireGuild(client, context, input.guildId);
  const member = await requireGuildMember(guild, input.memberId);
  if (input.addRoleIds?.length) await member.roles.add(input.addRoleIds, input.reason);
  if (input.removeRoleIds?.length) await member.roles.remove(input.removeRoleIds, input.reason);
  return `Updated roles for member ${member.user.tag} (${member.id}) in guild ${guild.id}`;
};

export const moderateDiscordMember = async (
  client: DiscordAdminClient,
  context: DiscordToolContext,
  input: ModerateDiscordMemberInput,
) => {
  const guild = await requireGuild(client, context, input.guildId);
  if (input.action === "ban") {
    await guild.members.ban(input.memberId, { deleteMessageSeconds: input.deleteMessageSeconds, reason: input.reason });
    return `Banned member ${input.memberId} in guild ${guild.id}`;
  }
  if (input.action === "unban") {
    await guild.bans.remove(input.memberId, input.reason);
    return `Unbanned member ${input.memberId} in guild ${guild.id}`;
  }
  const member = await requireGuildMember(guild, input.memberId);
  if (input.action === "timeout") {
    await member.timeout((input.durationMinutes ?? 5) * 60_000, input.reason);
  } else if (input.action === "remove_timeout") {
    await member.timeout(null, input.reason);
  } else if (input.action === "nickname") {
    await member.setNickname(input.nickname ?? null, input.reason);
  } else if (input.action === "kick") {
    await member.kick(input.reason);
  }
  return `Ran ${input.action} on member ${input.memberId} in guild ${guild.id}`;
};
