import { requireGuild } from "./discord-admin-helpers.js";
import type {
  CreateDiscordRoleInput,
  DiscordAdminClient,
  DiscordToolContext,
} from "./discord-admin-types.js";

const colorOf = (colorHex?: string) => {
  if (!colorHex) return undefined;
  const normalized = colorHex.startsWith("#") ? colorHex.slice(1) : colorHex;
  return Number.parseInt(normalized, 16);
};

export const createDiscordRole = async (
  client: DiscordAdminClient,
  context: DiscordToolContext,
  input: CreateDiscordRoleInput,
) => {
  const guild = await requireGuild(client, context, input.guildId);
  const role = await guild.roles.create({
    color: colorOf(input.colorHex),
    hoist: input.hoist,
    mentionable: input.mentionable,
    name: input.name,
  });
  return `Created role ${role.name} (${role.id}) in guild ${guild.id}`;
};
