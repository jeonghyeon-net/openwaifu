import { createSdkMcpServer, tool } from "@anthropic-ai/claude-agent-sdk";
import { ChannelType, type Client, type TextChannel } from "discord.js";
import { z } from "zod";

function ok(text: string) {
	return { content: [{ type: "text" as const, text }] };
}

function err(text: string) {
	return { content: [{ type: "text" as const, text }], isError: true };
}

export function createDiscordMcpServer(client: Client) {
	const sendMessage = tool(
		"discord_send_message",
		"Send a message to a Discord channel",
		{ channelId: z.string(), content: z.string() },
		async ({ channelId, content }) => {
			try {
				const ch = await client.channels.fetch(channelId);
				if (!ch?.isTextBased()) return err("Not a text channel");
				const msg = await (ch as TextChannel).send(content);
				return ok(`Sent message ${msg.id}`);
			} catch (e: unknown) {
				return err(e instanceof Error ? e.message : String(e));
			}
		},
	);

	const editMessage = tool(
		"discord_edit_message",
		"Edit a message in a Discord channel",
		{ channelId: z.string(), messageId: z.string(), content: z.string() },
		async ({ channelId, messageId, content }) => {
			try {
				const ch = await client.channels.fetch(channelId);
				if (!ch?.isTextBased()) return err("Not a text channel");
				const msg = await (ch as TextChannel).messages.fetch(messageId);
				await msg.edit(content);
				return ok(`Edited message ${messageId}`);
			} catch (e: unknown) {
				return err(e instanceof Error ? e.message : String(e));
			}
		},
	);

	const deleteMessage = tool(
		"discord_delete_message",
		"Delete a message from a Discord channel",
		{ channelId: z.string(), messageId: z.string() },
		async ({ channelId, messageId }) => {
			try {
				const ch = await client.channels.fetch(channelId);
				if (!ch?.isTextBased()) return err("Not a text channel");
				const msg = await (ch as TextChannel).messages.fetch(messageId);
				await msg.delete();
				return ok(`Deleted message ${messageId}`);
			} catch (e: unknown) {
				return err(e instanceof Error ? e.message : String(e));
			}
		},
	);

	const fetchMessages = tool(
		"discord_fetch_messages",
		"Fetch recent messages from a Discord channel",
		{ channelId: z.string(), limit: z.number().optional() },
		async ({ channelId, limit }) => {
			try {
				const ch = await client.channels.fetch(channelId);
				if (!ch?.isTextBased()) return err("Not a text channel");
				const msgs = await (ch as TextChannel).messages.fetch({
					limit: limit ?? 20,
				});
				const result = msgs.map((m) => ({
					id: m.id,
					author: m.author.username,
					content: m.content,
					timestamp: m.createdAt.toISOString(),
				}));
				return ok(JSON.stringify(result));
			} catch (e: unknown) {
				return err(e instanceof Error ? e.message : String(e));
			}
		},
	);

	const listChannels = tool(
		"discord_list_channels",
		"List all channels in a guild",
		{ guildId: z.string() },
		async ({ guildId }) => {
			try {
				const guild = await client.guilds.fetch(guildId);
				const channels = await guild.channels.fetch();
				const result = channels.map((ch) => ({
					id: ch?.id,
					name: ch?.name,
					type: ch?.type,
				}));
				return ok(JSON.stringify(result));
			} catch (e: unknown) {
				return err(e instanceof Error ? e.message : String(e));
			}
		},
	);

	const createChannel = tool(
		"discord_create_channel",
		"Create a new text channel in a guild",
		{ guildId: z.string(), name: z.string(), topic: z.string().optional() },
		async ({ guildId, name, topic }) => {
			try {
				const guild = await client.guilds.fetch(guildId);
				const opts: {
					name: string;
					type: ChannelType.GuildText;
					topic?: string;
				} = {
					name,
					type: ChannelType.GuildText,
				};
				if (topic) opts.topic = topic;
				const ch = await guild.channels.create(opts);
				return ok(`Created channel ${ch.id} (${ch.name})`);
			} catch (e: unknown) {
				return err(e instanceof Error ? e.message : String(e));
			}
		},
	);

	const deleteChannel = tool(
		"discord_delete_channel",
		"Delete a Discord channel",
		{ channelId: z.string() },
		async ({ channelId }) => {
			try {
				const ch = await client.channels.fetch(channelId);
				if (!ch) return err("Channel not found");
				await ch.delete();
				return ok(`Deleted channel ${channelId}`);
			} catch (e: unknown) {
				return err(e instanceof Error ? e.message : String(e));
			}
		},
	);

	const react = tool(
		"discord_react",
		"Add a reaction to a message",
		{ channelId: z.string(), messageId: z.string(), emoji: z.string() },
		async ({ channelId, messageId, emoji }) => {
			try {
				const ch = await client.channels.fetch(channelId);
				if (!ch?.isTextBased()) return err("Not a text channel");
				const msg = await (ch as TextChannel).messages.fetch(messageId);
				await msg.react(emoji);
				return ok(`Reacted with ${emoji}`);
			} catch (e: unknown) {
				return err(e instanceof Error ? e.message : String(e));
			}
		},
	);

	const pinMessage = tool(
		"discord_pin_message",
		"Pin a message in a channel",
		{ channelId: z.string(), messageId: z.string() },
		async ({ channelId, messageId }) => {
			try {
				const ch = await client.channels.fetch(channelId);
				if (!ch?.isTextBased()) return err("Not a text channel");
				const msg = await (ch as TextChannel).messages.fetch(messageId);
				await msg.pin();
				return ok(`Pinned message ${messageId}`);
			} catch (e: unknown) {
				return err(e instanceof Error ? e.message : String(e));
			}
		},
	);

	const unpinMessage = tool(
		"discord_unpin_message",
		"Unpin a message in a channel",
		{ channelId: z.string(), messageId: z.string() },
		async ({ channelId, messageId }) => {
			try {
				const ch = await client.channels.fetch(channelId);
				if (!ch?.isTextBased()) return err("Not a text channel");
				const msg = await (ch as TextChannel).messages.fetch(messageId);
				await msg.unpin();
				return ok(`Unpinned message ${messageId}`);
			} catch (e: unknown) {
				return err(e instanceof Error ? e.message : String(e));
			}
		},
	);

	const createThread = tool(
		"discord_create_thread",
		"Create a thread from a message",
		{ channelId: z.string(), messageId: z.string(), name: z.string() },
		async ({ channelId, messageId, name }) => {
			try {
				const ch = await client.channels.fetch(channelId);
				if (!ch?.isTextBased()) return err("Not a text channel");
				const msg = await (ch as TextChannel).messages.fetch(messageId);
				const thread = await msg.startThread({ name });
				return ok(`Created thread ${thread.id} (${thread.name})`);
			} catch (e: unknown) {
				return err(e instanceof Error ? e.message : String(e));
			}
		},
	);

	const listGuilds = tool(
		"discord_list_guilds",
		"List all guilds the bot is in",
		{},
		async () => {
			try {
				const guilds = await client.guilds.fetch();
				const result = guilds.map((g) => ({ id: g.id, name: g.name }));
				return ok(JSON.stringify(result));
			} catch (e: unknown) {
				return err(e instanceof Error ? e.message : String(e));
			}
		},
	);

	const getGuildMembers = tool(
		"discord_get_guild_members",
		"List members in a guild",
		{ guildId: z.string(), limit: z.number().optional() },
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
				return ok(JSON.stringify(result));
			} catch (e: unknown) {
				return err(e instanceof Error ? e.message : String(e));
			}
		},
	);

	const searchMessages = tool(
		"discord_search_messages",
		"Search messages in a channel by content",
		{
			channelId: z.string(),
			query: z.string(),
			limit: z.number().optional(),
		},
		async ({ channelId, query, limit }) => {
			try {
				const ch = await client.channels.fetch(channelId);
				if (!ch?.isTextBased()) return err("Not a text channel");
				const msgs = await (ch as TextChannel).messages.fetch({
					limit: limit ?? 100,
				});
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
			} catch (e: unknown) {
				return err(e instanceof Error ? e.message : String(e));
			}
		},
	);

	const setChannelTopic = tool(
		"discord_set_channel_topic",
		"Set the topic of a text channel",
		{ channelId: z.string(), topic: z.string() },
		async ({ channelId, topic }) => {
			try {
				const ch = await client.channels.fetch(channelId);
				if (ch?.type !== ChannelType.GuildText)
					return err("Not a text channel");
				await (ch as TextChannel).setTopic(topic);
				return ok(`Set topic for ${channelId}`);
			} catch (e: unknown) {
				return err(e instanceof Error ? e.message : String(e));
			}
		},
	);

	return createSdkMcpServer({
		name: "discord",
		tools: [
			sendMessage,
			editMessage,
			deleteMessage,
			fetchMessages,
			searchMessages,
			listChannels,
			createChannel,
			deleteChannel,
			createThread,
			react,
			pinMessage,
			unpinMessage,
			listGuilds,
			getGuildMembers,
			setChannelTopic,
		],
	});
}
