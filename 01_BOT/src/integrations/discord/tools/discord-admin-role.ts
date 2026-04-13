import type { Client } from "discord.js";

import type { DiscordAdminAccess } from "./discord-admin-access.js";
import { requireAdminActor } from "./discord-admin-actor.js";
import { requireGuild } from "./discord-admin-helpers.js";
import type { CreateDiscordRoleInput, DiscordToolContext } from "./discord-admin-types.js";

const colorOf = (colorHex?: string) => {
  if (!colorHex) return undefined;
  const normalized = colorHex.startsWith("#") ? colorHex.slice(1) : colorHex;
  return Number.parseInt(normalized, 16);
};

export const createDiscordRole = async (
  client: Client,
  context: DiscordToolContext,
  access: DiscordAdminAccess,
  input: CreateDiscordRoleInput,
) => {
  const guild = await requireGuild(client, context, access, input.guildId);
  await requireAdminActor(guild, context, access);
  const role = await guild.roles.create({
    color: colorOf(input.colorHex),
    hoist: input.hoist,
    mentionable: input.mentionable,
    name: input.name,
  });
  return `Created role ${role.name} (${role.id}) in guild ${guild.id}`;
};
