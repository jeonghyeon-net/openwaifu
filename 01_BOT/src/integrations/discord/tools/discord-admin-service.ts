import {
  createDiscordChannel,
  deleteDiscordChannel,
  sendDiscordMessage,
  updateDiscordChannel,
} from "./discord-admin-channel.js";
import { moderateDiscordMember, updateDiscordMemberRoles } from "./discord-admin-member.js";
import { listDiscordServers, inspectDiscordServer } from "./discord-admin-read.js";
import { createDiscordRole } from "./discord-admin-role.js";
import type {
  DiscordAdminClient,
  DiscordAdminService,
  DiscordToolContext,
} from "./discord-admin-types.js";

export const createDiscordAdminService = (
  client: DiscordAdminClient,
  context: DiscordToolContext,
): DiscordAdminService => ({
  listServers: () => listDiscordServers(client, context),
  inspectServer: (input) => inspectDiscordServer(client, context, input),
  sendMessage: (input) => sendDiscordMessage(client, context, input),
  createChannel: (input) => createDiscordChannel(client, context, input),
  updateChannel: (input) => updateDiscordChannel(client, context, input),
  deleteChannel: (input) => deleteDiscordChannel(client, context, input),
  createRole: (input) => createDiscordRole(client, context, input),
  updateMemberRoles: (input) => updateDiscordMemberRoles(client, context, input),
  moderateMember: (input) => moderateDiscordMember(client, context, input),
});
