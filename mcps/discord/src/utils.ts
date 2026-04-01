import type { Client, Guild, GuildMember, TextChannel } from "discord.js";

export function createUtils(client: Client) {
	async function getTextChannel(channelId: string): Promise<TextChannel> {
		const ch = await client.channels.fetch(channelId, { force: true });
		if (!ch?.isTextBased()) throw new Error("Not a text channel");
		return ch as TextChannel;
	}

	async function getGuild(guildId: string): Promise<Guild> {
		return client.guilds.fetch(guildId);
	}

	async function getChannel(channelId: string) {
		const ch = await client.channels.fetch(channelId);
		if (!ch) throw new Error("Channel not found");
		return ch;
	}

	async function getMember(
		guildId: string,
		userId: string,
	): Promise<GuildMember> {
		const guild = await getGuild(guildId);
		return guild.members.fetch(userId);
	}

	return { getTextChannel, getGuild, getChannel, getMember };
}

export type Utils = ReturnType<typeof createUtils>;
