import type { Client } from "discord.js";

import { createDiscordChannel, deleteDiscordChannel, sendDiscordMessage, updateDiscordChannel } from "./discord-admin-channel.js";
import { moderateDiscordMember, updateDiscordMemberRoles } from "./discord-admin-member.js";
import { listDiscordServers, inspectDiscordServer } from "./discord-admin-read.js";
import { createDiscordRole } from "./discord-admin-role.js";
import type { DiscordAdminAccess } from "./discord-admin-access.js";
import type { DiscordAdminService, DiscordToolContext } from "./discord-admin-types.js";

export const createDiscordAdminService = (
  client: Client,
  context: DiscordToolContext,
  access: DiscordAdminAccess,
): DiscordAdminService => ({
  listServers: () => listDiscordServers(client, context, access),
  inspectServer: (input) => inspectDiscordServer(client, context, access, input),
  sendMessage: (input) => sendDiscordMessage(client, context, access, input),
  createChannel: (input) => createDiscordChannel(client, context, access, input),
  updateChannel: (input) => updateDiscordChannel(client, context, access, input),
  deleteChannel: (input) => deleteDiscordChannel(client, context, access, input),
  createRole: (input) => createDiscordRole(client, context, access, input),
  updateMemberRoles: (input) => updateDiscordMemberRoles(client, context, access, input),
  moderateMember: (input) => moderateDiscordMember(client, context, access, input),
});
