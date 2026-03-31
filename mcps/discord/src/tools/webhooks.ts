import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Client, TextChannel } from "discord.js";
import { z } from "zod";
import { err, ok } from "../helpers.js";
import { embedSchema } from "../schemas.js";
import type { Utils } from "../utils.js";

export function registerWebhookTools(
	server: McpServer,
	client: Client,
	utils: Utils,
) {
	server.registerTool(
		"list_webhooks",
		{
			description: "List webhooks for a channel",
			inputSchema: { channelId: z.string() },
		},
		async ({ channelId }) => {
			try {
				const ch = await utils.getTextChannel(channelId);
				const webhooks = await (ch as TextChannel).fetchWebhooks();
				const result = webhooks.map((w) => ({
					id: w.id,
					name: w.name,
					channelId: w.channelId,
				}));
				return ok(JSON.stringify(result));
			} catch (e) {
				return err(e);
			}
		},
	);

	server.registerTool(
		"create_webhook",
		{
			description: "Create a webhook for a channel",
			inputSchema: {
				channelId: z.string(),
				name: z.string(),
				avatar: z.string().optional().describe("Avatar image URL"),
			},
		},
		async ({ channelId, name, avatar }) => {
			try {
				const ch = await utils.getTextChannel(channelId);
				const opts: Record<string, unknown> = { name };
				if (avatar) opts["avatar"] = avatar;
				const webhook = await (ch as TextChannel).createWebhook(opts as any);
				return ok(
					JSON.stringify({
						id: webhook.id,
						token: webhook.token,
						url: webhook.url,
					}),
				);
			} catch (e) {
				return err(e);
			}
		},
	);

	server.registerTool(
		"edit_webhook",
		{
			description: "Edit a webhook",
			inputSchema: {
				webhookId: z.string(),
				name: z.string().optional(),
				avatar: z.string().optional(),
				channelId: z.string().optional().describe("Move to different channel"),
			},
		},
		async ({ webhookId, name, avatar, channelId }) => {
			try {
				const webhook = await client.fetchWebhook(webhookId);
				const opts: Record<string, unknown> = {};
				if (name !== undefined) opts["name"] = name;
				if (avatar !== undefined) opts["avatar"] = avatar;
				if (channelId !== undefined) opts["channel"] = channelId;
				await webhook.edit(opts);
				return ok(`Edited webhook ${webhookId}`);
			} catch (e) {
				return err(e);
			}
		},
	);

	server.registerTool(
		"delete_webhook",
		{
			description: "Delete a webhook",
			inputSchema: { webhookId: z.string() },
		},
		async ({ webhookId }) => {
			try {
				const webhook = await client.fetchWebhook(webhookId);
				await webhook.delete();
				return ok(`Deleted webhook ${webhookId}`);
			} catch (e) {
				return err(e);
			}
		},
	);

	server.registerTool(
		"send_webhook_message",
		{
			description: "Send a message via webhook",
			inputSchema: {
				webhookId: z.string(),
				webhookToken: z.string(),
				content: z.string().optional(),
				embeds: z.array(embedSchema).optional(),
				username: z.string().optional().describe("Override webhook username"),
				avatarURL: z.string().optional().describe("Override webhook avatar"),
			},
		},
		async ({
			webhookId,
			webhookToken,
			content,
			embeds,
			username,
			avatarURL,
		}) => {
			try {
				const webhook = await client.fetchWebhook(webhookId, webhookToken);
				const opts: Record<string, unknown> = {};
				if (content) opts["content"] = content;
				if (embeds) opts["embeds"] = embeds;
				if (username) opts["username"] = username;
				if (avatarURL) opts["avatarURL"] = avatarURL;
				const msg = await webhook.send(opts);
				return ok(`Sent webhook message ${msg.id}`);
			} catch (e) {
				return err(e);
			}
		},
	);
}
