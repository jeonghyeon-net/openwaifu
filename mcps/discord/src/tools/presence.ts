import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ActivityType, type Client, type PresenceStatusData } from "discord.js";
import { z } from "zod";
import { err, ok } from "../helpers.js";
import type { Utils } from "../utils.js";

export function registerPresenceTools(
	server: McpServer,
	client: Client,
	_utils: Utils,
) {
	server.registerTool(
		"set_bot_presence",
		{
			description: "Set the bot's presence (status and activity)",
			inputSchema: {
				status: z
					.enum(["online", "idle", "dnd", "invisible"])
					.optional()
					.describe("Default: online"),
				activityName: z.string().optional().describe("Activity text"),
				activityType: z
					.enum([
						"Playing",
						"Streaming",
						"Listening",
						"Watching",
						"Competing",
						"Custom",
					])
					.optional()
					.describe("Default: Custom"),
			},
		},
		async ({ status, activityName, activityType }) => {
			try {
				const statusMap: Record<string, PresenceStatusData> = {
					online: "online",
					idle: "idle",
					dnd: "dnd",
					invisible: "invisible",
				};
				const typeMap: Record<string, ActivityType> = {
					Playing: ActivityType.Playing,
					Streaming: ActivityType.Streaming,
					Listening: ActivityType.Listening,
					Watching: ActivityType.Watching,
					Competing: ActivityType.Competing,
					Custom: ActivityType.Custom,
				};
				if (!client.user) throw new Error("Client is not ready");
				const resolvedStatus = statusMap[status ?? "online"]!;
				const resolvedType = typeMap[activityType ?? "Custom"]!;
				client.user.setPresence({
					status: resolvedStatus,
					activities: activityName
						? [{ name: activityName, type: resolvedType }]
						: [],
				});
				return ok("Updated bot presence");
			} catch (e) {
				return err(e);
			}
		},
	);
}
