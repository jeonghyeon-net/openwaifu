import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Client } from "discord.js";
import { z } from "zod";
import { err, ok } from "../helpers.js";
import type { Utils } from "../utils.js";

export function registerReactionTools(
	server: McpServer,
	_client: Client,
	utils: Utils,
) {
	server.registerTool(
		"react",
		{
			description: "Add a reaction to a message",
			inputSchema: {
				channelId: z.string(),
				messageId: z.string(),
				emoji: z.string(),
			},
		},
		async ({ channelId, messageId, emoji }) => {
			try {
				const ch = await utils.getTextChannel(channelId);
				const msg = await ch.messages.fetch(messageId);
				await msg.react(emoji);
				return ok(`Reacted with ${emoji}`);
			} catch (e) {
				return err(e);
			}
		},
	);

	server.registerTool(
		"remove_reaction",
		{
			description: "Remove a reaction from a message",
			inputSchema: {
				channelId: z.string(),
				messageId: z.string(),
				emoji: z.string(),
				userId: z
					.string()
					.optional()
					.describe("User ID (omit for bot's own reaction)"),
			},
		},
		async ({ channelId, messageId, emoji, userId }) => {
			try {
				const ch = await utils.getTextChannel(channelId);
				const msg = await ch.messages.fetch(messageId);
				const reaction = msg.reactions.resolve(emoji);
				if (!reaction) throw new Error("Reaction not found");
				if (userId) {
					await reaction.users.remove(userId);
				} else {
					await reaction.users.remove();
				}
				return ok(`Removed reaction ${emoji}`);
			} catch (e) {
				return err(e);
			}
		},
	);

	server.registerTool(
		"remove_all_reactions",
		{
			description:
				"Remove all reactions from a message (or all of a specific emoji)",
			inputSchema: {
				channelId: z.string(),
				messageId: z.string(),
				emoji: z
					.string()
					.optional()
					.describe("Specific emoji (omit to remove all)"),
			},
		},
		async ({ channelId, messageId, emoji }) => {
			try {
				const ch = await utils.getTextChannel(channelId);
				const msg = await ch.messages.fetch(messageId);
				if (emoji) {
					const reaction = msg.reactions.resolve(emoji);
					if (reaction) await reaction.remove();
				} else {
					await msg.reactions.removeAll();
				}
				return ok(
					emoji ? `Removed all ${emoji} reactions` : "Removed all reactions",
				);
			} catch (e) {
				return err(e);
			}
		},
	);

	server.registerTool(
		"get_reactions",
		{
			description: "Get users who reacted with a specific emoji",
			inputSchema: {
				channelId: z.string(),
				messageId: z.string(),
				emoji: z.string(),
				limit: z.number().optional(),
			},
		},
		async ({ channelId, messageId, emoji, limit }) => {
			try {
				const ch = await utils.getTextChannel(channelId);
				const msg = await ch.messages.fetch(messageId);
				const reaction = msg.reactions.resolve(emoji);
				if (!reaction) return ok(JSON.stringify([]));
				const users = await reaction.users.fetch({ limit: limit ?? 100 });
				const result = users.map((u) => ({ id: u.id, username: u.username }));
				return ok(JSON.stringify(result));
			} catch (e) {
				return err(e);
			}
		},
	);
}
