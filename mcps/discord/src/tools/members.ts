import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Client } from "discord.js";
import { z } from "zod";
import { err, ok } from "../helpers.js";
import type { Utils } from "../utils.js";

export function registerMemberTools(
	server: McpServer,
	_client: Client,
	utils: Utils,
) {
	server.registerTool(
		"get_guild_members",
		{
			description: "List members in a guild",
			inputSchema: { guildId: z.string(), limit: z.number().optional() },
		},
		async ({ guildId, limit }) => {
			try {
				const guild = await utils.getGuild(guildId);
				const members = await guild.members.fetch({ limit: limit ?? 50 });
				const result = members.map((m) => ({
					id: m.id,
					username: m.user.username,
					nickname: m.nickname,
					roles: m.roles.cache.map((r) => r.name),
				}));
				return ok(JSON.stringify(result));
			} catch (e) {
				return err(e);
			}
		},
	);

	server.registerTool(
		"get_member_info",
		{
			description: "Get detailed info about a guild member",
			inputSchema: { guildId: z.string(), userId: z.string() },
		},
		async ({ guildId, userId }) => {
			try {
				const member = await utils.getMember(guildId, userId);
				return ok(
					JSON.stringify({
						id: member.id,
						username: member.user.username,
						displayName: member.displayName,
						nickname: member.nickname,
						joinedAt: member.joinedAt?.toISOString(),
						roles: member.roles.cache.map((r) => ({
							id: r.id,
							name: r.name,
						})),
						permissions: member.permissions.toArray(),
						communicationDisabledUntil:
							member.communicationDisabledUntil?.toISOString(),
					}),
				);
			} catch (e) {
				return err(e);
			}
		},
	);

	server.registerTool(
		"edit_member",
		{
			description: "Edit a guild member's properties",
			inputSchema: {
				guildId: z.string(),
				userId: z.string(),
				nickname: z.string().optional(),
				mute: z.boolean().optional().describe("Server mute"),
				deaf: z.boolean().optional().describe("Server deafen"),
				channelId: z.string().optional().describe("Move to voice channel"),
			},
		},
		async ({ guildId, userId, nickname, mute, deaf, channelId }) => {
			try {
				const member = await utils.getMember(guildId, userId);
				const opts: Record<string, unknown> = {};
				if (nickname !== undefined) opts["nick"] = nickname;
				if (mute !== undefined) opts["mute"] = mute;
				if (deaf !== undefined) opts["deaf"] = deaf;
				if (channelId !== undefined) opts["channel"] = channelId;
				await member.edit(opts);
				return ok(`Edited member ${userId}`);
			} catch (e) {
				return err(e);
			}
		},
	);

	server.registerTool(
		"kick_member",
		{
			description: "Kick a member from the guild",
			inputSchema: {
				guildId: z.string(),
				userId: z.string(),
				reason: z.string().optional(),
			},
		},
		async ({ guildId, userId, reason }) => {
			try {
				const member = await utils.getMember(guildId, userId);
				await member.kick(reason);
				return ok(`Kicked ${userId}`);
			} catch (e) {
				return err(e);
			}
		},
	);

	server.registerTool(
		"ban_member",
		{
			description: "Ban a member from the guild",
			inputSchema: {
				guildId: z.string(),
				userId: z.string(),
				reason: z.string().optional(),
				deleteMessageSeconds: z
					.number()
					.optional()
					.describe("Delete messages from past N seconds (max 604800)"),
			},
		},
		async ({ guildId, userId, reason, deleteMessageSeconds }) => {
			try {
				const guild = await utils.getGuild(guildId);
				const opts: Record<string, unknown> = {};
				if (reason) opts["reason"] = reason;
				if (deleteMessageSeconds)
					opts["deleteMessageSeconds"] = deleteMessageSeconds;
				await guild.members.ban(userId, opts);
				return ok(`Banned ${userId}`);
			} catch (e) {
				return err(e);
			}
		},
	);

	server.registerTool(
		"unban_member",
		{
			description: "Unban a member from the guild",
			inputSchema: { guildId: z.string(), userId: z.string() },
		},
		async ({ guildId, userId }) => {
			try {
				const guild = await utils.getGuild(guildId);
				await guild.members.unban(userId);
				return ok(`Unbanned ${userId}`);
			} catch (e) {
				return err(e);
			}
		},
	);

	server.registerTool(
		"timeout_member",
		{
			description:
				"Timeout a member (set communicationDisabledUntil). Pass null duration to remove.",
			inputSchema: {
				guildId: z.string(),
				userId: z.string(),
				durationMs: z
					.number()
					.nullable()
					.describe("Timeout duration in ms (null to remove)"),
			},
		},
		async ({ guildId, userId, durationMs }) => {
			try {
				const member = await utils.getMember(guildId, userId);
				await member.timeout(durationMs);
				return ok(
					durationMs
						? `Timed out ${userId} for ${durationMs}ms`
						: `Removed timeout for ${userId}`,
				);
			} catch (e) {
				return err(e);
			}
		},
	);

	server.registerTool(
		"search_members",
		{
			description: "Search guild members by username/nickname",
			inputSchema: {
				guildId: z.string(),
				query: z.string(),
				limit: z.number().optional(),
			},
		},
		async ({ guildId, query, limit }) => {
			try {
				const guild = await utils.getGuild(guildId);
				const members = await guild.members.search({
					query,
					limit: limit ?? 20,
				});
				const result = members.map((m) => ({
					id: m.id,
					username: m.user.username,
					nickname: m.nickname,
				}));
				return ok(JSON.stringify(result));
			} catch (e) {
				return err(e);
			}
		},
	);
}
