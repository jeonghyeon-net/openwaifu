import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
	type Client,
	GuildScheduledEventEntityType,
	GuildScheduledEventPrivacyLevel,
} from "discord.js";
import { z } from "zod";
import { err, ok } from "../helpers.js";
import type { Utils } from "../utils.js";

export function registerEventTools(
	server: McpServer,
	_client: Client,
	utils: Utils,
) {
	server.registerTool(
		"list_events",
		{
			description: "List scheduled events in a guild",
			inputSchema: { guildId: z.string() },
		},
		async ({ guildId }) => {
			try {
				const guild = await utils.getGuild(guildId);
				const events = await guild.scheduledEvents.fetch();
				const result = events.map((e) => ({
					id: e.id,
					name: e.name,
					description: e.description,
					scheduledStartTime: e.scheduledStartAt?.toISOString(),
					scheduledEndTime: e.scheduledEndAt?.toISOString(),
					status: e.status,
					entityType: e.entityType,
					userCount: e.userCount,
				}));
				return ok(JSON.stringify(result));
			} catch (e) {
				return err(e);
			}
		},
	);

	server.registerTool(
		"create_event",
		{
			description: "Create a scheduled event in a guild",
			inputSchema: {
				guildId: z.string(),
				name: z.string(),
				scheduledStartTime: z.string().describe("ISO 8601 datetime"),
				scheduledEndTime: z.string().optional(),
				description: z.string().optional(),
				channelId: z
					.string()
					.optional()
					.describe("Required for voice/stage events"),
				entityType: z
					.enum(["voice", "stage", "external"])
					.describe("Event location type"),
				location: z
					.string()
					.optional()
					.describe("Required for external events"),
			},
		},
		async ({
			guildId,
			name,
			scheduledStartTime,
			scheduledEndTime,
			description,
			channelId,
			entityType,
			location,
		}) => {
			try {
				const guild = await utils.getGuild(guildId);
				const typeMap: Record<string, GuildScheduledEventEntityType> = {
					voice: GuildScheduledEventEntityType.Voice,
					stage: GuildScheduledEventEntityType.StageInstance,
					external: GuildScheduledEventEntityType.External,
				};
				const opts: Record<string, unknown> = {
					name,
					scheduledStartTime,
					entityType: typeMap[entityType],
					privacyLevel: GuildScheduledEventPrivacyLevel.GuildOnly,
				};
				if (scheduledEndTime) opts["scheduledEndTime"] = scheduledEndTime;
				if (description) opts["description"] = description;
				if (channelId) opts["channel"] = channelId;
				if (location) opts["entityMetadata"] = { location };
				const event = await guild.scheduledEvents.create(opts as any);
				return ok(`Created event ${event.id} (${event.name})`);
			} catch (e) {
				return err(e);
			}
		},
	);

	server.registerTool(
		"edit_event",
		{
			description: "Edit a scheduled event",
			inputSchema: {
				guildId: z.string(),
				eventId: z.string(),
				name: z.string().optional(),
				description: z.string().optional(),
				scheduledStartTime: z.string().optional(),
				scheduledEndTime: z.string().optional(),
				status: z
					.enum(["scheduled", "active", "completed", "canceled"])
					.optional(),
			},
		},
		async ({
			guildId,
			eventId,
			name,
			description,
			scheduledStartTime,
			scheduledEndTime,
			status,
		}) => {
			try {
				const guild = await utils.getGuild(guildId);
				const event = await guild.scheduledEvents.fetch(eventId);
				const opts: Record<string, unknown> = {};
				if (name !== undefined) opts["name"] = name;
				if (description !== undefined) opts["description"] = description;
				if (scheduledStartTime) opts["scheduledStartTime"] = scheduledStartTime;
				if (scheduledEndTime) opts["scheduledEndTime"] = scheduledEndTime;
				if (status) {
					const statusMap: Record<string, number> = {
						scheduled: 1,
						active: 2,
						completed: 3,
						canceled: 4,
					};
					opts["status"] = statusMap[status];
				}
				await event.edit(opts as any);
				return ok(`Edited event ${eventId}`);
			} catch (e) {
				return err(e);
			}
		},
	);

	server.registerTool(
		"delete_event",
		{
			description: "Delete a scheduled event",
			inputSchema: { guildId: z.string(), eventId: z.string() },
		},
		async ({ guildId, eventId }) => {
			try {
				const guild = await utils.getGuild(guildId);
				const event = await guild.scheduledEvents.fetch(eventId);
				await event.delete();
				return ok(`Deleted event ${eventId}`);
			} catch (e) {
				return err(e);
			}
		},
	);

	server.registerTool(
		"get_event_users",
		{
			description: "Get users subscribed to a scheduled event",
			inputSchema: {
				guildId: z.string(),
				eventId: z.string(),
				limit: z.number().optional(),
			},
		},
		async ({ guildId, eventId, limit }) => {
			try {
				const guild = await utils.getGuild(guildId);
				const event = await guild.scheduledEvents.fetch(eventId);
				const users = await event.fetchSubscribers({
					limit: limit ?? 100,
				});
				const result = users.map((u) => ({
					userId: u.user.id,
					username: u.user.username,
				}));
				return ok(JSON.stringify(result));
			} catch (e) {
				return err(e);
			}
		},
	);
}
