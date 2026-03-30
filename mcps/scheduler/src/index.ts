import { join } from "node:path";
import { findWorkspaceRoot } from "@lib/env";
import { Scheduler } from "@lib/scheduler";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const root = findWorkspaceRoot();
const scheduler = new Scheduler(join(root, "scheduler.db"));

const server = new McpServer({
	name: "scheduler",
	version: "0.0.1",
});

server.tool(
	"add_schedule",
	"Add a new cron schedule. The prompt will be sent to the LLM at the scheduled time.",
	{
		cronExpression: z
			.string()
			.describe("Cron expression (minute hour dayOfMonth month dayOfWeek)"),
		prompt: z.string().describe("Prompt to send to the LLM when triggered"),
		channelId: z.string().describe("Channel ID to send the response to"),
		createdBy: z.string().describe("User ID who created this schedule"),
	},
	async ({ cronExpression, prompt, channelId, createdBy }) => {
		try {
			const id = scheduler.add({
				cronExpression,
				prompt,
				channelId,
				createdBy,
			});
			return {
				content: [{ type: "text", text: `Schedule created with ID: ${id}` }],
			};
		} catch (e: unknown) {
			return {
				content: [
					{
						type: "text",
						text: e instanceof Error ? e.message : String(e),
					},
				],
				isError: true,
			};
		}
	},
);

server.tool(
	"list_schedules",
	"List all registered cron schedules",
	{},
	async () => {
		const schedules = scheduler.list();
		return {
			content: [{ type: "text", text: JSON.stringify(schedules, null, 2) }],
		};
	},
);

server.tool(
	"remove_schedule",
	"Remove a cron schedule by ID",
	{ id: z.string().describe("Schedule ID to remove") },
	async ({ id }) => {
		const removed = scheduler.remove(id);
		return {
			content: [
				{
					type: "text",
					text: removed ? `Schedule ${id} removed` : `Schedule ${id} not found`,
				},
			],
		};
	},
);

server.tool(
	"enable_schedule",
	"Enable a disabled cron schedule",
	{ id: z.string().describe("Schedule ID to enable") },
	async ({ id }) => {
		scheduler.enable(id);
		return {
			content: [{ type: "text", text: `Schedule ${id} enabled` }],
		};
	},
);

server.tool(
	"disable_schedule",
	"Disable a cron schedule without removing it",
	{ id: z.string().describe("Schedule ID to disable") },
	async ({ id }) => {
		scheduler.disable(id);
		return {
			content: [{ type: "text", text: `Schedule ${id} disabled` }],
		};
	},
);

await server.connect(new StdioServerTransport());
