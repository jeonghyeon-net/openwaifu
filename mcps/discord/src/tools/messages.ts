import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Client } from "discord.js";
import { z } from "zod";
import { err, ok } from "../helpers.js";
import { embedSchema } from "../schemas.js";
import type { Utils } from "../utils.js";

export function registerMessageTools(
	server: McpServer,
	_client: Client,
	utils: Utils,
) {
	server.registerTool(
		"send_message",
		{
			description:
				"Send a message to a Discord channel (supports embeds and file URLs)",
			inputSchema: {
				channelId: z.string(),
				content: z.string().optional(),
				embeds: z.array(embedSchema).optional(),
				files: z
					.array(z.string())
					.optional()
					.describe("Array of file URLs to attach"),
				replyTo: z.string().optional().describe("Message ID to reply to"),
			},
		},
		async ({ channelId, content, embeds, files, replyTo }) => {
			try {
				const ch = await utils.getTextChannel(channelId);
				const opts: Record<string, unknown> = {};
				if (content) opts["content"] = content;
				if (embeds) opts["embeds"] = embeds;
				if (files) opts["files"] = files;
				if (replyTo) opts["reply"] = { messageReference: replyTo };
				const msg = await ch.send(opts);
				return ok(`Sent message ${msg.id}`);
			} catch (e) {
				return err(e);
			}
		},
	);

	server.registerTool(
		"edit_message",
		{
			description: "Edit a message in a Discord channel",
			inputSchema: {
				channelId: z.string(),
				messageId: z.string(),
				content: z.string().optional(),
				embeds: z.array(embedSchema).optional(),
			},
		},
		async ({ channelId, messageId, content, embeds }) => {
			try {
				const ch = await utils.getTextChannel(channelId);
				const msg = await ch.messages.fetch(messageId);
				const opts: Record<string, unknown> = {};
				if (content !== undefined) opts["content"] = content;
				if (embeds) opts["embeds"] = embeds;
				await msg.edit(opts);
				return ok(`Edited message ${messageId}`);
			} catch (e) {
				return err(e);
			}
		},
	);

	server.registerTool(
		"delete_message",
		{
			description: "Delete a message from a Discord channel",
			inputSchema: { channelId: z.string(), messageId: z.string() },
		},
		async ({ channelId, messageId }) => {
			try {
				const ch = await utils.getTextChannel(channelId);
				const msg = await ch.messages.fetch(messageId);
				await msg.delete();
				return ok(`Deleted message ${messageId}`);
			} catch (e) {
				return err(e);
			}
		},
	);

	server.registerTool(
		"bulk_delete_messages",
		{
			description: "Bulk delete messages (2-100, max 14 days old)",
			inputSchema: {
				channelId: z.string(),
				messageIds: z.array(z.string()).describe("2-100 message IDs"),
			},
		},
		async ({ channelId, messageIds }) => {
			try {
				const ch = await utils.getTextChannel(channelId);
				const deleted = await ch.bulkDelete(messageIds);
				return ok(`Deleted ${deleted.size} messages`);
			} catch (e) {
				return err(e);
			}
		},
	);

	server.registerTool(
		"fetch_messages",
		{
			description: "Fetch messages from a Discord channel with pagination",
			inputSchema: {
				channelId: z.string(),
				limit: z.number().optional(),
				before: z.string().optional().describe("Fetch messages before this ID"),
				after: z.string().optional().describe("Fetch messages after this ID"),
				around: z.string().optional().describe("Fetch messages around this ID"),
			},
		},
		async ({ channelId, limit, before, after, around }) => {
			try {
				const ch = await utils.getTextChannel(channelId);
				const opts: Record<string, unknown> = { limit: limit ?? 20 };
				if (before) opts["before"] = before;
				if (after) opts["after"] = after;
				if (around) opts["around"] = around;
				const msgs = await ch.messages.fetch(opts);
				const result = msgs.map((m) => ({
					id: m.id,
					author: m.author.username,
					content: m.content,
					timestamp: m.createdAt.toISOString(),
					embeds: m.embeds.length,
					attachments: m.attachments.size,
				}));
				return ok(JSON.stringify(result));
			} catch (e) {
				return err(e);
			}
		},
	);

	server.registerTool(
		"search_messages",
		{
			description: "Search messages in a channel by content",
			inputSchema: {
				channelId: z.string(),
				query: z.string(),
				limit: z.number().optional(),
			},
		},
		async ({ channelId, query, limit }) => {
			try {
				const ch = await utils.getTextChannel(channelId);
				const msgs = await ch.messages.fetch({ limit: limit ?? 100 });
				const matched = msgs.filter((m) =>
					m.content.toLowerCase().includes(query.toLowerCase()),
				);
				const result = matched.map((m) => ({
					id: m.id,
					author: m.author.username,
					content: m.content,
					timestamp: m.createdAt.toISOString(),
				}));
				return ok(JSON.stringify(result));
			} catch (e) {
				return err(e);
			}
		},
	);

	server.registerTool(
		"reply_to_message",
		{
			description: "Reply to a specific message",
			inputSchema: {
				channelId: z.string(),
				messageId: z.string(),
				content: z.string().optional(),
				embeds: z.array(embedSchema).optional(),
				files: z.array(z.string()).optional(),
			},
		},
		async ({ channelId, messageId, content, embeds, files }) => {
			try {
				const ch = await utils.getTextChannel(channelId);
				const target = await ch.messages.fetch(messageId);
				const opts: Record<string, unknown> = {};
				if (content) opts["content"] = content;
				if (embeds) opts["embeds"] = embeds;
				if (files) opts["files"] = files;
				const msg = await target.reply(opts);
				return ok(`Replied with message ${msg.id}`);
			} catch (e) {
				return err(e);
			}
		},
	);

	server.registerTool(
		"crosspost_message",
		{
			description: "Crosspost a message in an announcement channel",
			inputSchema: { channelId: z.string(), messageId: z.string() },
		},
		async ({ channelId, messageId }) => {
			try {
				const ch = await utils.getTextChannel(channelId);
				const msg = await ch.messages.fetch(messageId);
				await msg.crosspost();
				return ok(`Crossposted message ${messageId}`);
			} catch (e) {
				return err(e);
			}
		},
	);

	server.registerTool(
		"fetch_pinned_messages",
		{
			description: "Fetch all pinned messages in a channel",
			inputSchema: { channelId: z.string() },
		},
		async ({ channelId }) => {
			try {
				const ch = await utils.getTextChannel(channelId);
				const pinned = await ch.messages.fetchPinned();
				const result = pinned.map((m) => ({
					id: m.id,
					author: m.author.username,
					content: m.content,
					timestamp: m.createdAt.toISOString(),
				}));
				return ok(JSON.stringify(result));
			} catch (e) {
				return err(e);
			}
		},
	);

	server.registerTool(
		"pin_message",
		{
			description: "Pin a message in a channel",
			inputSchema: { channelId: z.string(), messageId: z.string() },
		},
		async ({ channelId, messageId }) => {
			try {
				const ch = await utils.getTextChannel(channelId);
				const msg = await ch.messages.fetch(messageId);
				await msg.pin();
				return ok(`Pinned message ${messageId}`);
			} catch (e) {
				return err(e);
			}
		},
	);

	server.registerTool(
		"unpin_message",
		{
			description: "Unpin a message in a channel",
			inputSchema: { channelId: z.string(), messageId: z.string() },
		},
		async ({ channelId, messageId }) => {
			try {
				const ch = await utils.getTextChannel(channelId);
				const msg = await ch.messages.fetch(messageId);
				await msg.unpin();
				return ok(`Unpinned message ${messageId}`);
			} catch (e) {
				return err(e);
			}
		},
	);
}
