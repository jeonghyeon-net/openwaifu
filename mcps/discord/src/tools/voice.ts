import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Client } from "discord.js";
import { z } from "zod";
import { err, ok } from "../helpers.js";
import type { Utils } from "../utils.js";

export function registerVoiceTools(
	server: McpServer,
	_client: Client,
	utils: Utils,
) {
	server.registerTool(
		"get_voice_states",
		{
			description: "List voice channel occupants in a guild",
			inputSchema: { guildId: z.string() },
		},
		async ({ guildId }) => {
			try {
				const guild = await utils.getGuild(guildId);
				const states = guild.voiceStates.cache;
				const result = states.map((vs) => ({
					userId: vs.member?.user.id,
					username: vs.member?.user.username,
					channelId: vs.channelId,
					channelName: vs.channel?.name,
					selfMute: vs.selfMute,
					selfDeaf: vs.selfDeaf,
					serverMute: vs.serverMute,
					serverDeaf: vs.serverDeaf,
					streaming: vs.streaming,
				}));
				return ok(JSON.stringify(result));
			} catch (e) {
				return err(e);
			}
		},
	);

	server.registerTool(
		"move_member_voice",
		{
			description: "Move a member to a different voice channel",
			inputSchema: {
				guildId: z.string(),
				userId: z.string(),
				channelId: z.string().describe("Target voice channel ID"),
			},
		},
		async ({ guildId, userId, channelId }) => {
			try {
				const member = await utils.getMember(guildId, userId);
				await member.voice.setChannel(channelId);
				return ok(`Moved ${userId} to voice channel ${channelId}`);
			} catch (e) {
				return err(e);
			}
		},
	);

	server.registerTool(
		"disconnect_member_voice",
		{
			description: "Disconnect a member from voice",
			inputSchema: { guildId: z.string(), userId: z.string() },
		},
		async ({ guildId, userId }) => {
			try {
				const member = await utils.getMember(guildId, userId);
				await member.voice.disconnect();
				return ok(`Disconnected ${userId} from voice`);
			} catch (e) {
				return err(e);
			}
		},
	);
}
