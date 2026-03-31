import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Client } from "discord.js";
import { z } from "zod";
import { err, ok } from "../helpers.js";
import type { Utils } from "../utils.js";

const automodActionSchema = z.object({
	type: z.number().describe("1=BlockMessage, 2=SendAlertMessage, 3=Timeout"),
	metadata: z
		.object({
			channelId: z.string().optional(),
			durationSeconds: z.number().optional(),
			customMessage: z.string().optional(),
		})
		.optional(),
});

export function registerAutomodTools(
	server: McpServer,
	_client: Client,
	utils: Utils,
) {
	server.registerTool(
		"list_automod_rules",
		{
			description: "List auto-moderation rules in a guild",
			inputSchema: { guildId: z.string() },
		},
		async ({ guildId }) => {
			try {
				const guild = await utils.getGuild(guildId);
				const rules = await guild.autoModerationRules.fetch();
				const result = rules.map((r) => ({
					id: r.id,
					name: r.name,
					enabled: r.enabled,
					eventType: r.eventType,
					triggerType: r.triggerType,
					actions: r.actions,
				}));
				return ok(JSON.stringify(result));
			} catch (e) {
				return err(e);
			}
		},
	);

	server.registerTool(
		"create_automod_rule",
		{
			description: "Create an auto-moderation rule",
			inputSchema: {
				guildId: z.string(),
				name: z.string(),
				eventType: z.number().describe("1=MessageSend"),
				triggerType: z
					.number()
					.describe("1=Keyword, 3=Spam, 4=KeywordPreset, 5=MentionSpam"),
				triggerMetadata: z
					.object({
						keywordFilter: z.array(z.string()).optional(),
						presets: z.array(z.number()).optional(),
						mentionTotalLimit: z.number().optional(),
					})
					.optional(),
				actions: z.array(automodActionSchema),
				enabled: z.boolean().optional(),
			},
		},
		async ({
			guildId,
			name,
			eventType,
			triggerType,
			triggerMetadata,
			actions,
			enabled,
		}) => {
			try {
				const guild = await utils.getGuild(guildId);
				const opts: Record<string, unknown> = {
					name,
					eventType,
					triggerType,
					actions,
				};
				if (triggerMetadata) opts["triggerMetadata"] = triggerMetadata;
				if (enabled !== undefined) opts["enabled"] = enabled;
				const rule = await guild.autoModerationRules.create(opts as any);
				return ok(`Created automod rule ${rule.id} (${rule.name})`);
			} catch (e) {
				return err(e);
			}
		},
	);

	server.registerTool(
		"edit_automod_rule",
		{
			description: "Edit an auto-moderation rule",
			inputSchema: {
				guildId: z.string(),
				ruleId: z.string(),
				name: z.string().optional(),
				triggerMetadata: z
					.object({
						keywordFilter: z.array(z.string()).optional(),
						presets: z.array(z.number()).optional(),
						mentionTotalLimit: z.number().optional(),
					})
					.optional(),
				actions: z.array(automodActionSchema).optional(),
				enabled: z.boolean().optional(),
			},
		},
		async ({ guildId, ruleId, name, triggerMetadata, actions, enabled }) => {
			try {
				const guild = await utils.getGuild(guildId);
				const rule = await guild.autoModerationRules.fetch(ruleId);
				const opts: Record<string, unknown> = {};
				if (name !== undefined) opts["name"] = name;
				if (triggerMetadata) opts["triggerMetadata"] = triggerMetadata;
				if (actions) opts["actions"] = actions;
				if (enabled !== undefined) opts["enabled"] = enabled;
				await rule.edit(opts as any);
				return ok(`Edited automod rule ${ruleId}`);
			} catch (e) {
				return err(e);
			}
		},
	);

	server.registerTool(
		"delete_automod_rule",
		{
			description: "Delete an auto-moderation rule",
			inputSchema: { guildId: z.string(), ruleId: z.string() },
		},
		async ({ guildId, ruleId }) => {
			try {
				const guild = await utils.getGuild(guildId);
				const rule = await guild.autoModerationRules.fetch(ruleId);
				await rule.delete();
				return ok(`Deleted automod rule ${ruleId}`);
			} catch (e) {
				return err(e);
			}
		},
	);
}
