import type { Guild, GuildMember, Role } from "discord.js";

import type { DiscordAdminAccess } from "./discord-admin-access.js";
import { requireGuildMember } from "./discord-admin-helpers.js";
import type { DiscordToolContext } from "./discord-admin-types.js";

export const requireAdminActor = async (
  guild: Guild,
  context: DiscordToolContext,
  access: DiscordAdminAccess,
): Promise<GuildMember | null> => {
  if (!access.scopeGuildId) return null;
  const actor = await requireGuildMember(guild, context.authorId);
  if (!actor.permissions.has("Administrator")) {
    throw new Error(`Author no longer has Administrator in guild ${guild.id}`);
  }
  return actor;
};

export const assertActorAboveMember = (guild: Guild, actor: GuildMember | null, member: GuildMember) => {
  if (!actor || guild.ownerId === actor.id) return;
  if (actor.roles.highest.comparePositionTo(member.roles.highest) <= 0) {
    throw new Error(`Target member above actor hierarchy: ${member.id}`);
  }
};

export const assertActorAboveRoles = (guild: Guild, actor: GuildMember | null, roles: Role[]) => {
  if (!actor || guild.ownerId === actor.id) return;
  for (const role of roles) {
    if (actor.roles.highest.comparePositionTo(role) <= 0) {
      throw new Error(`Target role above actor hierarchy: ${role.id}`);
    }
  }
};
