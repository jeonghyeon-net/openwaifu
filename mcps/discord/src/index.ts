import { env } from "@lib/env";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
	ChannelType,
	Client,
	GatewayIntentBits,
	type TextChannel,
} from "discord.js";
import { z } from "zod";

const server = new McpServer({ name: "discord", version: "0.0.1" });

const client = new Client({
	intents: [
		GatewayIntentBits.Guilds,
		GatewayIntentBits.GuildMessages,
		GatewayIntentBits.GuildMembers,
		GatewayIntentBits.MessageContent,
	],
});

function getTextChannel(channelId: string): Promise<TextChannel> {
	return client.channels.fetch(channelId).then((ch) => {
		if (!ch?.isTextBased()) throw new Error("Not a text channel");
		return ch as TextChannel;
	});
}

server.registerTool(
	"send_message",
	{
		description: "Send a message to a Discord channel",
		inputSchema: { channelId: z.string(), content: z.string() },
	},
	async ({ channelId, content }) => {
		try {
			const ch = await getTextChannel(channelId);
			const msg = await ch.send(content);
			return { content: [{ type: "text", text: `Sent message ${msg.id}` }] };
		} catch (e: unknown) {
			const message = e instanceof Error ? e.message : String(e);
			return { content: [{ type: "text", text: message }], isError: true };
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
			content: z.string(),
		},
	},
	async ({ channelId, messageId, content }) => {
		try {
			const ch = await getTextChannel(channelId);
			const msg = await ch.messages.fetch(messageId);
			await msg.edit(content);
			return {
				content: [{ type: "text", text: `Edited message ${messageId}` }],
			};
		} catch (e: unknown) {
			const message = e instanceof Error ? e.message : String(e);
			return { content: [{ type: "text", text: message }], isError: true };
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
			const ch = await getTextChannel(channelId);
			const msg = await ch.messages.fetch(messageId);
			await msg.delete();
			return {
				content: [{ type: "text", text: `Deleted message ${messageId}` }],
			};
		} catch (e: unknown) {
			const message = e instanceof Error ? e.message : String(e);
			return { content: [{ type: "text", text: message }], isError: true };
		}
	},
);

server.registerTool(
	"fetch_messages",
	{
		description: "Fetch recent messages from a Discord channel",
		inputSchema: { channelId: z.string(), limit: z.number().optional() },
	},
	async ({ channelId, limit }) => {
		try {
			const ch = await getTextChannel(channelId);
			const msgs = await ch.messages.fetch({ limit: limit ?? 20 });
			const result = msgs.map((m) => ({
				id: m.id,
				author: m.author.username,
				content: m.content,
				timestamp: m.createdAt.toISOString(),
			}));
			return { content: [{ type: "text", text: JSON.stringify(result) }] };
		} catch (e: unknown) {
			const message = e instanceof Error ? e.message : String(e);
			return { content: [{ type: "text", text: message }], isError: true };
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
			const ch = await getTextChannel(channelId);
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
			return { content: [{ type: "text", text: JSON.stringify(result) }] };
		} catch (e: unknown) {
			const message = e instanceof Error ? e.message : String(e);
			return { content: [{ type: "text", text: message }], isError: true };
		}
	},
);

server.registerTool(
	"list_channels",
	{
		description: "List all channels in a guild",
		inputSchema: { guildId: z.string() },
	},
	async ({ guildId }) => {
		try {
			const guild = await client.guilds.fetch(guildId);
			const channels = await guild.channels.fetch();
			const result = channels.map((ch) => ({
				id: ch?.id,
				name: ch?.name,
				type: ch?.type,
			}));
			return { content: [{ type: "text", text: JSON.stringify(result) }] };
		} catch (e: unknown) {
			const message = e instanceof Error ? e.message : String(e);
			return { content: [{ type: "text", text: message }], isError: true };
		}
	},
);

server.registerTool(
	"create_channel",
	{
		description: "Create a new text channel in a guild",
		inputSchema: {
			guildId: z.string(),
			name: z.string(),
			topic: z.string().optional(),
		},
	},
	async ({ guildId, name, topic }) => {
		try {
			const guild = await client.guilds.fetch(guildId);
			const opts: {
				name: string;
				type: ChannelType.GuildText;
				topic?: string;
			} = { name, type: ChannelType.GuildText };
			if (topic) opts.topic = topic;
			const ch = await guild.channels.create(opts);
			return {
				content: [
					{ type: "text", text: `Created channel ${ch.id} (${ch.name})` },
				],
			};
		} catch (e: unknown) {
			const message = e instanceof Error ? e.message : String(e);
			return { content: [{ type: "text", text: message }], isError: true };
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
			const ch = await client.channels.fetch(channelId);
			if (!ch) throw new Error("Channel not found");
			await ch.delete();
			return {
				content: [{ type: "text", text: `Deleted channel ${channelId}` }],
			};
		} catch (e: unknown) {
			const message = e instanceof Error ? e.message : String(e);
			return { content: [{ type: "text", text: message }], isError: true };
		}
	},
);

server.registerTool(
	"create_thread",
	{
		description: "Create a thread from a message",
		inputSchema: {
			channelId: z.string(),
			messageId: z.string(),
			name: z.string(),
		},
	},
	async ({ channelId, messageId, name }) => {
		try {
			const ch = await getTextChannel(channelId);
			const msg = await ch.messages.fetch(messageId);
			const thread = await msg.startThread({ name });
			return {
				content: [
					{
						type: "text",
						text: `Created thread ${thread.id} (${thread.name})`,
					},
				],
			};
		} catch (e: unknown) {
			const message = e instanceof Error ? e.message : String(e);
			return { content: [{ type: "text", text: message }], isError: true };
		}
	},
);

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
			const ch = await getTextChannel(channelId);
			const msg = await ch.messages.fetch(messageId);
			await msg.react(emoji);
			return {
				content: [{ type: "text", text: `Reacted with ${emoji}` }],
			};
		} catch (e: unknown) {
			const message = e instanceof Error ? e.message : String(e);
			return { content: [{ type: "text", text: message }], isError: true };
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
			const ch = await getTextChannel(channelId);
			const msg = await ch.messages.fetch(messageId);
			await msg.pin();
			return {
				content: [{ type: "text", text: `Pinned message ${messageId}` }],
			};
		} catch (e: unknown) {
			const message = e instanceof Error ? e.message : String(e);
			return { content: [{ type: "text", text: message }], isError: true };
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
			const ch = await getTextChannel(channelId);
			const msg = await ch.messages.fetch(messageId);
			await msg.unpin();
			return {
				content: [{ type: "text", text: `Unpinned message ${messageId}` }],
			};
		} catch (e: unknown) {
			const message = e instanceof Error ? e.message : String(e);
			return { content: [{ type: "text", text: message }], isError: true };
		}
	},
);

server.registerTool(
	"list_guilds",
	{ description: "List all guilds the bot is in" },
	async () => {
		try {
			const guilds = await client.guilds.fetch();
			const result = guilds.map((g) => ({ id: g.id, name: g.name }));
			return { content: [{ type: "text", text: JSON.stringify(result) }] };
		} catch (e: unknown) {
			const message = e instanceof Error ? e.message : String(e);
			return { content: [{ type: "text", text: message }], isError: true };
		}
	},
);

server.registerTool(
	"get_guild_members",
	{
		description: "List members in a guild",
		inputSchema: { guildId: z.string(), limit: z.number().optional() },
	},
	async ({ guildId, limit }) => {
		try {
			const guild = await client.guilds.fetch(guildId);
			const members = await guild.members.fetch({ limit: limit ?? 50 });
			const result = members.map((m) => ({
				id: m.id,
				username: m.user.username,
				nickname: m.nickname,
				roles: m.roles.cache.map((r) => r.name),
			}));
			return { content: [{ type: "text", text: JSON.stringify(result) }] };
		} catch (e: unknown) {
			const message = e instanceof Error ? e.message : String(e);
			return { content: [{ type: "text", text: message }], isError: true };
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
			const ch = await client.channels.fetch(channelId);
			if (ch?.type !== ChannelType.GuildText)
				throw new Error("Not a text channel");
			await (ch as TextChannel).setTopic(topic);
			return {
				content: [{ type: "text", text: `Set topic for ${channelId}` }],
			};
		} catch (e: unknown) {
			const message = e instanceof Error ? e.message : String(e);
			return { content: [{ type: "text", text: message }], isError: true };
		}
	},
);

const token = env("DISCORD_TOKEN");
const loginPromise = client.login(token);
await server.connect(new StdioServerTransport());
await loginPromise;
