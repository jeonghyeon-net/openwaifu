import type { Client } from "discord.js";

export const discordManagementToolNames = [
  "discord_list_servers",
  "discord_inspect_server",
  "discord_send_message",
  "discord_create_channel",
  "discord_update_channel",
  "discord_delete_channel",
  "discord_create_role",
  "discord_update_member_roles",
  "discord_moderate_member",
] as const;

export type DiscordAdminClient = Pick<Client, "channels" | "guilds">;

export type DiscordToolContext = {
  authorId: string;
  channelId: string;
  guildId?: string;
  isDirectMessage: boolean;
};

export type InspectDiscordServerInput = {
  guildId?: string;
  view: "summary" | "channels" | "roles" | "members";
  limit?: number;
};
export type SendDiscordMessageInput = { channelId?: string; content: string };
export type CreateDiscordChannelInput = {
  guildId?: string;
  name: string;
  type: "text" | "voice" | "forum" | "announcement";
  categoryId?: string;
  topic?: string;
};
export type UpdateDiscordChannelInput = {
  channelId: string;
  name?: string;
  categoryId?: string;
  topic?: string;
  reason?: string;
};
export type DeleteDiscordChannelInput = { channelId: string; reason?: string };
export type CreateDiscordRoleInput = { guildId?: string; name: string; colorHex?: string; hoist?: boolean; mentionable?: boolean };
export type UpdateDiscordMemberRolesInput = {
  guildId?: string;
  memberId: string;
  addRoleIds?: string[];
  removeRoleIds?: string[];
  reason?: string;
};
export type ModerateDiscordMemberInput = {
  guildId?: string;
  memberId: string;
  action: "timeout" | "remove_timeout" | "nickname" | "kick" | "ban" | "unban";
  durationMinutes?: number;
  nickname?: string;
  deleteMessageSeconds?: number;
  reason?: string;
};
export type DiscordAdminService = {
  listServers(): Promise<string>;
  inspectServer(input: InspectDiscordServerInput): Promise<string>;
  sendMessage(input: SendDiscordMessageInput): Promise<string>;
  createChannel(input: CreateDiscordChannelInput): Promise<string>;
  updateChannel(input: UpdateDiscordChannelInput): Promise<string>;
  deleteChannel(input: DeleteDiscordChannelInput): Promise<string>;
  createRole(input: CreateDiscordRoleInput): Promise<string>;
  updateMemberRoles(input: UpdateDiscordMemberRolesInput): Promise<string>;
  moderateMember(input: ModerateDiscordMemberInput): Promise<string>;
};
