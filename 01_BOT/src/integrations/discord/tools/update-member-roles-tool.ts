import { defineTool } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";

import type { DiscordAdminService } from "./discord-admin-types.js";
import { discordToolResult } from "./discord-tool-result.js";

export const createUpdateMemberRolesTool = (service: DiscordAdminService) =>
  defineTool({
    name: "discord_update_member_roles",
    label: "Discord Update Member Roles",
    description: "Add or remove Discord member roles in current or specified guild.",
    promptSnippet: "`discord_update_member_roles`: add or remove roles for Discord member",
    parameters: Type.Object({
      guildId: Type.Optional(Type.String({ description: "Optional guild id. Defaults to current guild." })),
      memberId: Type.String({ description: "Member id to update" }),
      addRoleIds: Type.Optional(Type.Array(Type.String({ description: "Role id to add" }))),
      removeRoleIds: Type.Optional(Type.Array(Type.String({ description: "Role id to remove" }))),
      reason: Type.Optional(Type.String({ description: "Optional audit log reason" })),
    }),
    execute: async (_id, input) => discordToolResult(await service.updateMemberRoles(input)),
  });
