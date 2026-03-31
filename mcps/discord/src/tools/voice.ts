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
	// get_voice_states는 게이트웨이 캐시에 의존하므로 REST-only 모드에서 제거

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
