import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Client } from "discord.js";
import { z } from "zod";
import { err, ok } from "../helpers.js";
import type { Utils } from "../utils.js";

export function registerStickerTools(
	server: McpServer,
	_client: Client,
	utils: Utils,
) {
	server.registerTool(
		"list_stickers",
		{
			description: "List custom stickers in a guild",
			inputSchema: { guildId: z.string() },
		},
		async ({ guildId }) => {
			try {
				const guild = await utils.getGuild(guildId);
				const stickers = await guild.stickers.fetch();
				const result = stickers.map((s) => ({
					id: s.id,
					name: s.name,
					description: s.description,
					tags: s.tags,
					format: s.format,
					url: s.url,
				}));
				return ok(JSON.stringify(result));
			} catch (e) {
				return err(e);
			}
		},
	);

	server.registerTool(
		"create_sticker",
		{
			description: "Create a custom sticker in a guild",
			inputSchema: {
				guildId: z.string(),
				name: z.string(),
				description: z.string(),
				tags: z.string().describe("Autocomplete/suggestion tag"),
				fileUrl: z.string().describe("Sticker image URL (PNG, APNG, Lottie)"),
			},
		},
		async ({ guildId, name, description, tags, fileUrl }) => {
			try {
				const guild = await utils.getGuild(guildId);
				const sticker = await guild.stickers.create({
					file: fileUrl,
					name,
					description,
					tags,
				} as any);
				return ok(`Created sticker ${sticker.id} (${sticker.name})`);
			} catch (e) {
				return err(e);
			}
		},
	);

	server.registerTool(
		"delete_sticker",
		{
			description: "Delete a custom sticker from a guild",
			inputSchema: { guildId: z.string(), stickerId: z.string() },
		},
		async ({ guildId, stickerId }) => {
			try {
				const guild = await utils.getGuild(guildId);
				await guild.stickers.delete(stickerId);
				return ok(`Deleted sticker ${stickerId}`);
			} catch (e) {
				return err(e);
			}
		},
	);
}
