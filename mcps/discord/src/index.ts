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

server.tool(
	"send_message",
	"Send a message to a Discord channel",
	{ channelId: z.string(), content: z.string() },
	async ({ channelId, content }) => {
		const ch = await getTextChannel(channelId);
		const msg = await ch.send(content);
		return { content: [{ type: "text", text: `Sent message ${msg.id}` }] };
	},
);

server.tool(
	"edit_message",
	"Edit a message in a Discord channel",
	{ channelId: z.string(), messageId: z.string(), content: z.string() },
	async ({ channelId, messageId, content }) => {
		const ch = await getTextChannel(channelId);
		const msg = await ch.messages.fetch(messageId);
		await msg.edit(content);
		return {
			content: [{ type: "text", text: `Edited message ${messageId}` }],
		};
	},
);

server.tool(
	"delete_message",
	"Delete a message from a Discord channel",
	{ channelId: z.string(), messageId: z.string() },
	async ({ channelId, messageId }) => {
		const ch = await getTextChannel(channelId);
		const msg = await ch.messages.fetch(messageId);
		await msg.delete();
		return {
			content: [{ type: "text", text: `Deleted message ${messageId}` }],
		};
	},
);

server.tool(
	"fetch_messages",
	"Fetch recent messages from a Discord channel",
	{ channelId: z.string(), limit: z.number().optional() },
	async ({ channelId, limit }) => {
		const ch = await getTextChannel(channelId);
		const msgs = await ch.messages.fetch({ limit: limit ?? 20 });
		const result = msgs.map((m) => ({
			id: m.id,
			author: m.author.username,
			content: m.content,
			timestamp: m.createdAt.toISOString(),
		}));
		return { content: [{ type: "text", text: JSON.stringify(result) }] };
	},
);

server.tool(
	"search_messages",
	"Search messages in a channel by content",
	{ channelId: z.string(), query: z.string(), limit: z.number().optional() },
	async ({ channelId, query, limit }) => {
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
	},
);

server.tool(
	"list_channels",
	"List all channels in a guild",
	{ guildId: z.string() },
	async ({ guildId }) => {
		const guild = await client.guilds.fetch(guildId);
		const channels = await guild.channels.fetch();
		const result = channels.map((ch) => ({
			id: ch?.id,
			name: ch?.name,
			type: ch?.type,
		}));
		return { content: [{ type: "text", text: JSON.stringify(result) }] };
	},
);

server.tool(
	"create_channel",
	"Create a new text channel in a guild",
	{ guildId: z.string(), name: z.string(), topic: z.string().optional() },
	async ({ guildId, name, topic }) => {
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
	},
);

server.tool(
	"delete_channel",
	"Delete a Discord channel",
	{ channelId: z.string() },
	async ({ channelId }) => {
		const ch = await client.channels.fetch(channelId);
		if (!ch) throw new Error("Channel not found");
		await ch.delete();
		return {
			content: [{ type: "text", text: `Deleted channel ${channelId}` }],
		};
	},
);

server.tool(
	"create_thread",
	"Create a thread from a message",
	{ channelId: z.string(), messageId: z.string(), name: z.string() },
	async ({ channelId, messageId, name }) => {
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
	},
);

server.tool(
	"react",
	"Add a reaction to a message",
	{ channelId: z.string(), messageId: z.string(), emoji: z.string() },
	async ({ channelId, messageId, emoji }) => {
		const ch = await getTextChannel(channelId);
		const msg = await ch.messages.fetch(messageId);
		await msg.react(emoji);
		return {
			content: [{ type: "text", text: `Reacted with ${emoji}` }],
		};
	},
);

server.tool(
	"pin_message",
	"Pin a message in a channel",
	{ channelId: z.string(), messageId: z.string() },
	async ({ channelId, messageId }) => {
		const ch = await getTextChannel(channelId);
		const msg = await ch.messages.fetch(messageId);
		await msg.pin();
		return {
			content: [{ type: "text", text: `Pinned message ${messageId}` }],
		};
	},
);

server.tool(
	"unpin_message",
	"Unpin a message in a channel",
	{ channelId: z.string(), messageId: z.string() },
	async ({ channelId, messageId }) => {
		const ch = await getTextChannel(channelId);
		const msg = await ch.messages.fetch(messageId);
		await msg.unpin();
		return {
			content: [{ type: "text", text: `Unpinned message ${messageId}` }],
		};
	},
);

server.tool("list_guilds", "List all guilds the bot is in", {}, async () => {
	const guilds = await client.guilds.fetch();
	const result = guilds.map((g) => ({ id: g.id, name: g.name }));
	return { content: [{ type: "text", text: JSON.stringify(result) }] };
});

server.tool(
	"get_guild_members",
	"List members in a guild",
	{ guildId: z.string(), limit: z.number().optional() },
	async ({ guildId, limit }) => {
		const guild = await client.guilds.fetch(guildId);
		const members = await guild.members.fetch({ limit: limit ?? 50 });
		const result = members.map((m) => ({
			id: m.id,
			username: m.user.username,
			nickname: m.nickname,
			roles: m.roles.cache.map((r) => r.name),
		}));
		return { content: [{ type: "text", text: JSON.stringify(result) }] };
	},
);

server.tool(
	"set_channel_topic",
	"Set the topic of a text channel",
	{ channelId: z.string(), topic: z.string() },
	async ({ channelId, topic }) => {
		const ch = await client.channels.fetch(channelId);
		if (ch?.type !== ChannelType.GuildText)
			throw new Error("Not a text channel");
		await (ch as TextChannel).setTopic(topic);
		return {
			content: [{ type: "text", text: `Set topic for ${channelId}` }],
		};
	},
);

const token = env("DISCORD_TOKEN");
const loginPromise = client.login(token);
await server.connect(new StdioServerTransport());
await loginPromise;
