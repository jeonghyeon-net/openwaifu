import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Client } from "discord.js";
import { z } from "zod";
import { err, ok } from "../helpers.js";
import type { Utils } from "../utils.js";

export function registerEmojiTools(
	server: McpServer,
	_client: Client,
	utils: Utils,
) {
	server.registerTool(
		"list_emojis",
		{
			description: "List custom emojis in a guild",
			inputSchema: { guildId: z.string() },
		},
		async ({ guildId }) => {
			try {
				const guild = await utils.getGuild(guildId);
				const emojis = await guild.emojis.fetch();
				const result = emojis.map((e) => ({
					id: e.id,
					name: e.name,
					animated: e.animated,
					url: e.url,
				}));
				return ok(JSON.stringify(result));
			} catch (e) {
				return err(e);
			}
		},
	);

	server.registerTool(
		"create_emoji",
		{
			description: "Create a custom emoji from an image URL",
			inputSchema: {
				guildId: z.string(),
				name: z.string(),
				imageUrl: z.string().describe("URL of the emoji image"),
				roles: z
					.array(z.string())
					.optional()
					.describe("Role IDs that can use this emoji"),
			},
		},
		async ({ guildId, name, imageUrl, roles }) => {
			try {
				const guild = await utils.getGuild(guildId);
				const opts: Record<string, unknown> = {
					attachment: imageUrl,
					name,
				};
				if (roles) opts["roles"] = roles;
				const emoji = await guild.emojis.create(opts as any);
				return ok(`Created emoji ${emoji.id} (${emoji.name})`);
			} catch (e) {
				return err(e);
			}
		},
	);

	server.registerTool(
		"delete_emoji",
		{
			description: "Delete a custom emoji from a guild",
			inputSchema: { guildId: z.string(), emojiId: z.string() },
		},
		async ({ guildId, emojiId }) => {
			try {
				const guild = await utils.getGuild(guildId);
				await guild.emojis.delete(emojiId);
				return ok(`Deleted emoji ${emojiId}`);
			} catch (e) {
				return err(e);
			}
		},
	);
}
