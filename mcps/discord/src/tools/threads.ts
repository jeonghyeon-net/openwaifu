import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ChannelType, type Client, type ThreadChannel } from "discord.js";
import { z } from "zod";
import { err, ok } from "../helpers.js";
import type { Utils } from "../utils.js";

function asThread(ch: unknown): ThreadChannel {
	const c = ch as any;
	if (!c?.isThread?.()) throw new Error("Not a thread channel");
	return c as ThreadChannel;
}

export function registerThreadTools(
	server: McpServer,
	_client: Client,
	utils: Utils,
) {
	server.registerTool(
		"create_thread",
		{
			description: "Create a thread from a message",
			inputSchema: {
				channelId: z.string(),
				messageId: z.string(),
				name: z.string(),
				autoArchiveDuration: z
					.number()
					.optional()
					.describe("Minutes: 60, 1440, 4320, or 10080"),
			},
		},
		async ({ channelId, messageId, name, autoArchiveDuration }) => {
			try {
				const ch = await utils.getTextChannel(channelId);
				const msg = await ch.messages.fetch(messageId);
				const opts: Record<string, unknown> = { name };
				if (autoArchiveDuration)
					opts["autoArchiveDuration"] = autoArchiveDuration;
				const thread = await msg.startThread(opts as any);
				return ok(`Created thread ${thread.id} (${thread.name})`);
			} catch (e) {
				return err(e);
			}
		},
	);

	server.registerTool(
		"create_thread_without_message",
		{
			description: "Create a standalone thread in a channel",
			inputSchema: {
				channelId: z.string(),
				name: z.string(),
				autoArchiveDuration: z.number().optional(),
				type: z
					.enum(["public", "private"])
					.optional()
					.describe("Default: public"),
			},
		},
		async ({ channelId, name, autoArchiveDuration, type }) => {
			try {
				const ch = await utils.getTextChannel(channelId);
				const opts: Record<string, unknown> = {
					name,
					type:
						type === "private"
							? ChannelType.PrivateThread
							: ChannelType.PublicThread,
				};
				if (autoArchiveDuration)
					opts["autoArchiveDuration"] = autoArchiveDuration;
				const thread = await ch.threads.create(opts as any);
				return ok(`Created thread ${thread.id} (${thread.name})`);
			} catch (e) {
				return err(e);
			}
		},
	);

	server.registerTool(
		"join_thread",
		{
			description: "Bot joins a thread",
			inputSchema: { threadId: z.string() },
		},
		async ({ threadId }) => {
			try {
				const ch = await utils.getChannel(threadId);
				const thread = asThread(ch);
				await thread.join();
				return ok(`Joined thread ${threadId}`);
			} catch (e) {
				return err(e);
			}
		},
	);

	server.registerTool(
		"leave_thread",
		{
			description: "Bot leaves a thread",
			inputSchema: { threadId: z.string() },
		},
		async ({ threadId }) => {
			try {
				const ch = await utils.getChannel(threadId);
				const thread = asThread(ch);
				await thread.leave();
				return ok(`Left thread ${threadId}`);
			} catch (e) {
				return err(e);
			}
		},
	);

	server.registerTool(
		"add_thread_member",
		{
			description: "Add a member to a thread",
			inputSchema: { threadId: z.string(), userId: z.string() },
		},
		async ({ threadId, userId }) => {
			try {
				const ch = await utils.getChannel(threadId);
				const thread = asThread(ch);
				await thread.members.add(userId);
				return ok(`Added ${userId} to thread ${threadId}`);
			} catch (e) {
				return err(e);
			}
		},
	);

	server.registerTool(
		"remove_thread_member",
		{
			description: "Remove a member from a thread",
			inputSchema: { threadId: z.string(), userId: z.string() },
		},
		async ({ threadId, userId }) => {
			try {
				const ch = await utils.getChannel(threadId);
				const thread = asThread(ch);
				await thread.members.remove(userId);
				return ok(`Removed ${userId} from thread ${threadId}`);
			} catch (e) {
				return err(e);
			}
		},
	);

	server.registerTool(
		"archive_thread",
		{
			description: "Archive a thread",
			inputSchema: { threadId: z.string() },
		},
		async ({ threadId }) => {
			try {
				const ch = await utils.getChannel(threadId);
				const thread = asThread(ch);
				await thread.setArchived(true);
				return ok(`Archived thread ${threadId}`);
			} catch (e) {
				return err(e);
			}
		},
	);

	server.registerTool(
		"unarchive_thread",
		{
			description: "Unarchive a thread",
			inputSchema: { threadId: z.string() },
		},
		async ({ threadId }) => {
			try {
				const ch = await utils.getChannel(threadId);
				const thread = asThread(ch);
				await thread.setArchived(false);
				return ok(`Unarchived thread ${threadId}`);
			} catch (e) {
				return err(e);
			}
		},
	);

	server.registerTool(
		"lock_thread",
		{
			description: "Lock a thread (prevents non-moderators from sending)",
			inputSchema: { threadId: z.string() },
		},
		async ({ threadId }) => {
			try {
				const ch = await utils.getChannel(threadId);
				const thread = asThread(ch);
				await thread.setLocked(true);
				return ok(`Locked thread ${threadId}`);
			} catch (e) {
				return err(e);
			}
		},
	);

	server.registerTool(
		"fetch_thread_members",
		{
			description: "List members of a thread",
			inputSchema: { threadId: z.string() },
		},
		async ({ threadId }) => {
			try {
				const ch = await utils.getChannel(threadId);
				const thread = asThread(ch);
				const members = await thread.members.fetch();
				const result = members.map((m) => ({
					id: m.id,
					userId: m.user?.id,
					joinedAt: m.joinedAt?.toISOString(),
				}));
				return ok(JSON.stringify(result));
			} catch (e) {
				return err(e);
			}
		},
	);

	server.registerTool(
		"fetch_active_threads",
		{
			description: "List all active threads in a guild",
			inputSchema: { guildId: z.string() },
		},
		async ({ guildId }) => {
			try {
				const guild = await utils.getGuild(guildId);
				const { threads } = await guild.channels.fetchActiveThreads();
				const result = threads.map((t) => ({
					id: t.id,
					name: t.name,
					parentId: t.parentId,
					messageCount: t.messageCount,
					memberCount: t.memberCount,
				}));
				return ok(JSON.stringify(result));
			} catch (e) {
				return err(e);
			}
		},
	);
}
