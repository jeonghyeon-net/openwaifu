import { describe, expect, it } from "vitest";

import { createDiscordManagementTools } from "../src/integrations/discord/tools/discord-management-tools";
import type { DiscordAdminService } from "../src/integrations/discord/tools/discord-admin-types";

const service: DiscordAdminService = {
  listServers: async () => "",
  inspectServer: async () => "",
  sendMessage: async () => "",
  createChannel: async () => "",
  updateChannel: async () => "",
  deleteChannel: async () => "",
  createRole: async () => "",
  updateMemberRoles: async () => "",
  moderateMember: async () => "",
};

describe("createDiscordManagementTools", () => {
  it("includes discord server management tools", () => {
    expect(createDiscordManagementTools(service).map((tool) => tool.name)).toEqual([
      "discord_list_servers",
      "discord_inspect_server",
      "discord_send_message",
      "discord_create_channel",
      "discord_update_channel",
      "discord_delete_channel",
      "discord_create_role",
      "discord_update_member_roles",
      "discord_moderate_member",
    ]);
  });
});
