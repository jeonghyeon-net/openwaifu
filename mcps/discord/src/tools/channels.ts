import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ChannelType, type Client, type TextChannel } from "discord.js";
import { z } from "zod";
import { err, ok } from "../helpers.js";
import type { Utils } from "../utils.js";

export function registerChannelTools(
	server: McpServer,
	_client: Client,
	utils: Utils,
) {
	server.registerTool(
		"list_channels",
		{
			description: "List all channels in a guild",
			inputSchema: { guildId: z.string() },
		},
		async ({ guildId }) => {
			try {
				const guild = await utils.getGuild(guildId);
				const channels = await guild.channels.fetch();
				const result = channels.map((ch) => ({
					id: ch?.id,
					name: ch?.name,
					type: ch?.type,
					parentId: ch?.parentId,
					position: ch?.position,
				}));
				return ok(JSON.stringify(result));
			} catch (e) {
				return err(e);
			}
		},
	);

	server.registerTool(
		"get_channel_info",
		{
			description: "Get detailed information about a channel",
			inputSchema: { channelId: z.string() },
		},
		async ({ channelId }) => {
			try {
				const ch = await utils.getChannel(channelId);
				const info: Record<string, unknown> = {
					id: ch.id,
					type: ch.type,
				};
				if ("name" in ch) info["name"] = ch.name;
				if ("topic" in ch) info["topic"] = (ch as TextChannel).topic;
				if ("nsfw" in ch) info["nsfw"] = (ch as TextChannel).nsfw;
				if ("rateLimitPerUser" in ch)
					info["rateLimitPerUser"] = (ch as TextChannel).rateLimitPerUser;
				if ("parentId" in ch) info["parentId"] = ch.parentId;
				if ("position" in ch) info["position"] = ch.position;
				return ok(JSON.stringify(info));
			} catch (e) {
				return err(e);
			}
		},
	);

	server.registerTool(
		"create_channel",
		{
			description: "Create a channel in a guild (text, voice, category, etc.)",
			inputSchema: {
				guildId: z.string(),
				name: z.string(),
				type: z
					.enum(["text", "voice", "category", "announcement", "stage", "forum"])
					.optional()
					.describe("Default: text"),
				topic: z.string().optional(),
				parentId: z.string().optional().describe("Category ID"),
				nsfw: z.boolean().optional(),
				rateLimitPerUser: z.number().optional().describe("Slowmode in seconds"),
			},
		},
		async ({
			guildId,
			name,
			type,
			topic,
			parentId,
			nsfw,
			rateLimitPerUser,
		}) => {
			try {
				const guild = await utils.getGuild(guildId);
				const typeMap: Record<string, ChannelType> = {
					text: ChannelType.GuildText,
					voice: ChannelType.GuildVoice,
					category: ChannelType.GuildCategory,
					announcement: ChannelType.GuildAnnouncement,
					stage: ChannelType.GuildStageVoice,
					forum: ChannelType.GuildForum,
				};
				const opts: Record<string, unknown> = {
					name,
					type: typeMap[type ?? "text"],
				};
				if (topic) opts["topic"] = topic;
				if (parentId) opts["parent"] = parentId;
				if (nsfw !== undefined) opts["nsfw"] = nsfw;
				if (rateLimitPerUser !== undefined)
					opts["rateLimitPerUser"] = rateLimitPerUser;
				const ch = await guild.channels.create(opts as any);
				return ok(`Created channel ${ch.id} (${ch.name})`);
			} catch (e) {
				return err(e);
			}
		},
	);

	server.registerTool(
		"edit_channel",
		{
			description: "Edit channel properties",
			inputSchema: {
				channelId: z.string(),
				name: z.string().optional(),
				topic: z.string().optional(),
				nsfw: z.boolean().optional(),
				rateLimitPerUser: z.number().optional(),
				position: z.number().optional(),
				parentId: z.string().optional().describe("Move to category"),
			},
		},
		async ({
			channelId,
			name,
			topic,
			nsfw,
			rateLimitPerUser,
			position,
			parentId,
		}) => {
			try {
				const ch = await utils.getChannel(channelId);
				if (!("edit" in ch))
					throw new Error("Channel does not support editing");
				const opts: Record<string, unknown> = {};
				if (name !== undefined) opts["name"] = name;
				if (topic !== undefined) opts["topic"] = topic;
				if (nsfw !== undefined) opts["nsfw"] = nsfw;
				if (rateLimitPerUser !== undefined)
					opts["rateLimitPerUser"] = rateLimitPerUser;
				if (position !== undefined) opts["position"] = position;
				if (parentId !== undefined) opts["parent"] = parentId;
				await (ch as any).edit(opts);
				return ok(`Edited channel ${channelId}`);
			} catch (e) {
				return err(e);
			}
		},
	);

	server.registerTool(
		"delete_channel",
		{
			description: "Delete a Discord channel",
			inputSchema: { channelId: z.string() },
		},
		async ({ channelId }) => {
			try {
				const ch = await utils.getChannel(channelId);
				await ch.delete();
				return ok(`Deleted channel ${channelId}`);
			} catch (e) {
				return err(e);
			}
		},
	);

	server.registerTool(
		"set_channel_topic",
		{
			description: "Set the topic of a text channel",
			inputSchema: { channelId: z.string(), topic: z.string() },
		},
		async ({ channelId, topic }) => {
			try {
				const ch = await utils.getChannel(channelId);
				if (ch.type !== ChannelType.GuildText)
					throw new Error("Not a text channel");
				await (ch as TextChannel).setTopic(topic);
				return ok(`Set topic for ${channelId}`);
			} catch (e) {
				return err(e);
			}
		},
	);

	server.registerTool(
		"set_channel_permissions",
		{
			description: "Set permission overwrite for a role or member on a channel",
			inputSchema: {
				channelId: z.string(),
				targetId: z.string().describe("Role or member ID"),
				allow: z
					.array(z.string())
					.optional()
					.describe(
						"Permission names to allow (e.g. SendMessages, ViewChannel)",
					),
				deny: z
					.array(z.string())
					.optional()
					.describe("Permission names to deny"),
			},
		},
		async ({ channelId, targetId, allow, deny }) => {
			try {
				const ch = await utils.getChannel(channelId);
				if (!("permissionOverwrites" in ch))
					throw new Error("Channel does not support permissions");
				const perms: Record<string, boolean> = {};
				if (allow) for (const p of allow) perms[p] = true;
				if (deny) for (const p of deny) perms[p] = false;
				await (ch as any).permissionOverwrites.edit(targetId, perms);
				return ok(`Updated permissions for ${targetId} on ${channelId}`);
			} catch (e) {
				return err(e);
			}
		},
	);

	server.registerTool(
		"clone_channel",
		{
			description: "Clone a channel",
			inputSchema: {
				channelId: z.string(),
				name: z.string().optional().describe("Name for the clone"),
			},
		},
		async ({ channelId, name }) => {
			try {
				const ch = await utils.getChannel(channelId);
				if (!("clone" in ch))
					throw new Error("Channel does not support cloning");
				const cloned = await (ch as any).clone(name ? { name } : undefined);
				return ok(`Cloned channel → ${cloned.id} (${cloned.name})`);
			} catch (e) {
				return err(e);
			}
		},
	);

	server.registerTool(
		"set_slowmode",
		{
			description: "Set slowmode rate limit for a channel (0 to disable)",
			inputSchema: {
				channelId: z.string(),
				seconds: z.number().describe("Seconds (0 to disable)"),
			},
		},
		async ({ channelId, seconds }) => {
			try {
				const ch = await utils.getChannel(channelId);
				if (!("setRateLimitPerUser" in ch))
					throw new Error("Channel does not support slowmode");
				await (ch as any).setRateLimitPerUser(seconds);
				return ok(`Set slowmode to ${seconds}s for ${channelId}`);
			} catch (e) {
				return err(e);
			}
		},
	);
}
