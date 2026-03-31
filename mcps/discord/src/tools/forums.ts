import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ChannelType, type Client, type ForumChannel } from "discord.js";
import { z } from "zod";
import { err, ok } from "../helpers.js";
import type { Utils } from "../utils.js";

function asForumChannel(ch: unknown): ForumChannel {
	const c = ch as any;
	if (c?.type !== ChannelType.GuildForum)
		throw new Error("Not a forum channel");
	return c as ForumChannel;
}

export function registerForumTools(
	server: McpServer,
	_client: Client,
	utils: Utils,
) {
	server.registerTool(
		"create_forum_post",
		{
			description: "Create a new post (thread) in a forum channel",
			inputSchema: {
				channelId: z.string(),
				name: z.string().describe("Post title"),
				content: z.string().describe("Initial message content"),
				appliedTags: z
					.array(z.string())
					.optional()
					.describe("Tag IDs to apply"),
			},
		},
		async ({ channelId, name, content, appliedTags }) => {
			try {
				const ch = await utils.getChannel(channelId);
				const forum = asForumChannel(ch);
				const opts: Record<string, unknown> = {
					name,
					message: { content },
				};
				if (appliedTags) opts["appliedTags"] = appliedTags;
				const thread = await forum.threads.create(opts as any);
				return ok(`Created forum post ${thread.id} (${thread.name})`);
			} catch (e) {
				return err(e);
			}
		},
	);

	server.registerTool(
		"get_forum_tags",
		{
			description: "Get available tags for a forum channel",
			inputSchema: { channelId: z.string() },
		},
		async ({ channelId }) => {
			try {
				const ch = await utils.getChannel(channelId);
				const forum = asForumChannel(ch);
				const tags = forum.availableTags.map((t) => ({
					id: t.id,
					name: t.name,
					emoji: t.emoji,
					moderated: t.moderated,
				}));
				return ok(JSON.stringify(tags));
			} catch (e) {
				return err(e);
			}
		},
	);

	server.registerTool(
		"edit_forum_tags",
		{
			description: "Set the available tags for a forum channel",
			inputSchema: {
				channelId: z.string(),
				tags: z.array(
					z.object({
						name: z.string(),
						moderated: z.boolean().optional(),
						emoji: z.string().optional().describe("Unicode emoji or emoji ID"),
					}),
				),
			},
		},
		async ({ channelId, tags }) => {
			try {
				const ch = await utils.getChannel(channelId);
				const forum = asForumChannel(ch);
				await forum.setAvailableTags(
					tags.map((t) => ({
						name: t.name,
						moderated: t.moderated,
						emoji: t.emoji ? { name: t.emoji } : undefined,
					})) as any,
				);
				return ok(`Updated forum tags for ${channelId}`);
			} catch (e) {
				return err(e);
			}
		},
	);
}
