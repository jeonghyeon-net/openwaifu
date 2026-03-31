import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { AuditLogEvent, Client } from "discord.js";
import { z } from "zod";
import { err, ok } from "../helpers.js";
import type { Utils } from "../utils.js";

export function registerGuildTools(
	server: McpServer,
	client: Client,
	utils: Utils,
) {
	server.registerTool(
		"list_guilds",
		{ description: "List all guilds the bot is in" },
		async () => {
			try {
				const guilds = await client.guilds.fetch();
				const result = guilds.map((g) => ({ id: g.id, name: g.name }));
				return ok(JSON.stringify(result));
			} catch (e) {
				return err(e);
			}
		},
	);

	server.registerTool(
		"get_guild_info",
		{
			description: "Get detailed information about a guild",
			inputSchema: { guildId: z.string() },
		},
		async ({ guildId }) => {
			try {
				const guild = await utils.getGuild(guildId);
				return ok(
					JSON.stringify({
						id: guild.id,
						name: guild.name,
						description: guild.description,
						memberCount: guild.memberCount,
						ownerId: guild.ownerId,
						createdAt: guild.createdAt.toISOString(),
						icon: guild.iconURL(),
						banner: guild.bannerURL(),
						features: guild.features,
						premiumTier: guild.premiumTier,
						premiumSubscriptionCount: guild.premiumSubscriptionCount,
						vanityURLCode: guild.vanityURLCode,
					}),
				);
			} catch (e) {
				return err(e);
			}
		},
	);

	server.registerTool(
		"edit_guild",
		{
			description: "Edit guild properties",
			inputSchema: {
				guildId: z.string(),
				name: z.string().optional(),
				description: z.string().optional(),
				icon: z.string().optional().describe("Icon image URL"),
			},
		},
		async ({ guildId, name, description, icon }) => {
			try {
				const guild = await utils.getGuild(guildId);
				const opts: Record<string, unknown> = {};
				if (name !== undefined) opts["name"] = name;
				if (description !== undefined) opts["description"] = description;
				if (icon !== undefined) opts["icon"] = icon;
				await guild.edit(opts);
				return ok(`Edited guild ${guildId}`);
			} catch (e) {
				return err(e);
			}
		},
	);

	server.registerTool(
		"get_guild_bans",
		{
			description: "List banned users in a guild",
			inputSchema: {
				guildId: z.string(),
				limit: z.number().optional(),
			},
		},
		async ({ guildId, limit }) => {
			try {
				const guild = await utils.getGuild(guildId);
				const bans = await guild.bans.fetch({ limit: limit ?? 50 });
				const result = bans.map((b) => ({
					userId: b.user.id,
					username: b.user.username,
					reason: b.reason,
				}));
				return ok(JSON.stringify(result));
			} catch (e) {
				return err(e);
			}
		},
	);

	server.registerTool(
		"get_audit_log",
		{
			description: "Query the guild audit log",
			inputSchema: {
				guildId: z.string(),
				limit: z.number().optional(),
				actionType: z
					.number()
					.optional()
					.describe("AuditLogEvent number (e.g. 24 = MemberBanAdd)"),
				userId: z
					.string()
					.optional()
					.describe("Filter by user who performed action"),
			},
		},
		async ({ guildId, limit, actionType, userId }) => {
			try {
				const guild = await utils.getGuild(guildId);
				const opts: Record<string, unknown> = { limit: limit ?? 20 };
				if (actionType !== undefined)
					opts["type"] = actionType as AuditLogEvent;
				if (userId) opts["user"] = userId;
				const logs = await guild.fetchAuditLogs(opts as any);
				const result = logs.entries.map((e) => ({
					id: e.id,
					action: e.action,
					executor: e.executor?.username,
					target: (e.target as any)?.id,
					reason: e.reason,
					createdAt: e.createdAt.toISOString(),
				}));
				return ok(JSON.stringify(result));
			} catch (e) {
				return err(e);
			}
		},
	);

	server.registerTool(
		"get_guild_preview",
		{
			description:
				"Get a guild's public preview (works for discoverable guilds)",
			inputSchema: { guildId: z.string() },
		},
		async ({ guildId }) => {
			try {
				const preview = await client.fetchGuildPreview(guildId);
				return ok(
					JSON.stringify({
						id: preview.id,
						name: preview.name,
						description: preview.description,
						approximateMemberCount: preview.approximateMemberCount,
						approximatePresenceCount: preview.approximatePresenceCount,
						features: preview.features,
					}),
				);
			} catch (e) {
				return err(e);
			}
		},
	);
}
