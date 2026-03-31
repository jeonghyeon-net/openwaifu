import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Client } from "discord.js";
import { z } from "zod";
import { err, ok } from "../helpers.js";
import type { Utils } from "../utils.js";

export function registerRoleTools(
	server: McpServer,
	_client: Client,
	utils: Utils,
) {
	server.registerTool(
		"list_roles",
		{
			description: "List all roles in a guild",
			inputSchema: { guildId: z.string() },
		},
		async ({ guildId }) => {
			try {
				const guild = await utils.getGuild(guildId);
				const roles = await guild.roles.fetch();
				const result = roles.map((r) => ({
					id: r.id,
					name: r.name,
					color: r.hexColor,
					position: r.position,
					memberCount: r.members.size,
					permissions: r.permissions.toArray(),
				}));
				return ok(JSON.stringify(result));
			} catch (e) {
				return err(e);
			}
		},
	);

	server.registerTool(
		"create_role",
		{
			description: "Create a new role in a guild",
			inputSchema: {
				guildId: z.string(),
				name: z.string(),
				color: z.string().optional().describe("Hex color e.g. #ff0000"),
				permissions: z
					.array(z.string())
					.optional()
					.describe("Permission names"),
				hoist: z
					.boolean()
					.optional()
					.describe("Show separately in member list"),
				mentionable: z.boolean().optional(),
			},
		},
		async ({ guildId, name, color, permissions, hoist, mentionable }) => {
			try {
				const guild = await utils.getGuild(guildId);
				const opts: Record<string, unknown> = { name };
				if (color) opts["color"] = color;
				if (permissions) opts["permissions"] = permissions;
				if (hoist !== undefined) opts["hoist"] = hoist;
				if (mentionable !== undefined) opts["mentionable"] = mentionable;
				const role = await guild.roles.create(opts as any);
				return ok(`Created role ${role.id} (${role.name})`);
			} catch (e) {
				return err(e);
			}
		},
	);

	server.registerTool(
		"edit_role",
		{
			description: "Edit a role's properties",
			inputSchema: {
				guildId: z.string(),
				roleId: z.string(),
				name: z.string().optional(),
				color: z.string().optional(),
				permissions: z.array(z.string()).optional(),
				hoist: z.boolean().optional(),
				mentionable: z.boolean().optional(),
			},
		},
		async ({
			guildId,
			roleId,
			name,
			color,
			permissions,
			hoist,
			mentionable,
		}) => {
			try {
				const guild = await utils.getGuild(guildId);
				const role = await guild.roles.fetch(roleId);
				if (!role) throw new Error("Role not found");
				const opts: Record<string, unknown> = {};
				if (name !== undefined) opts["name"] = name;
				if (color !== undefined) opts["color"] = color;
				if (permissions) opts["permissions"] = permissions;
				if (hoist !== undefined) opts["hoist"] = hoist;
				if (mentionable !== undefined) opts["mentionable"] = mentionable;
				await role.edit(opts as any);
				return ok(`Edited role ${roleId}`);
			} catch (e) {
				return err(e);
			}
		},
	);

	server.registerTool(
		"delete_role",
		{
			description: "Delete a role from a guild",
			inputSchema: { guildId: z.string(), roleId: z.string() },
		},
		async ({ guildId, roleId }) => {
			try {
				const guild = await utils.getGuild(guildId);
				const role = await guild.roles.fetch(roleId);
				if (!role) throw new Error("Role not found");
				await role.delete();
				return ok(`Deleted role ${roleId}`);
			} catch (e) {
				return err(e);
			}
		},
	);

	server.registerTool(
		"add_role_to_member",
		{
			description: "Assign a role to a guild member",
			inputSchema: {
				guildId: z.string(),
				userId: z.string(),
				roleId: z.string(),
			},
		},
		async ({ guildId, userId, roleId }) => {
			try {
				const member = await utils.getMember(guildId, userId);
				await member.roles.add(roleId);
				return ok(`Added role ${roleId} to ${userId}`);
			} catch (e) {
				return err(e);
			}
		},
	);

	server.registerTool(
		"remove_role_from_member",
		{
			description: "Remove a role from a guild member",
			inputSchema: {
				guildId: z.string(),
				userId: z.string(),
				roleId: z.string(),
			},
		},
		async ({ guildId, userId, roleId }) => {
			try {
				const member = await utils.getMember(guildId, userId);
				await member.roles.remove(roleId);
				return ok(`Removed role ${roleId} from ${userId}`);
			} catch (e) {
				return err(e);
			}
		},
	);
}
