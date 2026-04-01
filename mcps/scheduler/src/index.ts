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

server.registerTool(
	"add_schedule",
	{
		description:
			"Add a new cron schedule. The prompt is sent to the LLM at the scheduled time. The LLM can then use tools (e.g. discord send_message) to act on it. All times are in KST (Asia/Seoul, UTC+9).",
		inputSchema: {
			cronExpression: z
				.string()
				.describe(
					"Cron expression (minute hour dayOfMonth month dayOfWeek) in KST (Asia/Seoul, UTC+9)",
				),
			prompt: z
				.string()
				.describe(
					"Prompt to send to the LLM when triggered. Include instructions like which channel to send to.",
				),
			createdBy: z.string().describe("User ID who created this schedule"),
			once: z
				.boolean()
				.optional()
				.describe(
					"If true, the schedule runs once and is automatically removed",
				),
		},
	},
	async ({ cronExpression, prompt, createdBy, once }) => {
		try {
			const id = scheduler.add({
				cronExpression,
				prompt,
				createdBy,
				once: once ?? false,
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

server.registerTool(
	"list_schedules",
	{
		description:
			"List all registered cron schedules. All cron times are in KST (Asia/Seoul, UTC+9).",
	},
	async () => {
		const schedules = scheduler.list();
		return {
			content: [{ type: "text", text: JSON.stringify(schedules, null, 2) }],
		};
	},
);

server.registerTool(
	"remove_schedule",
	{
		description: "Remove a cron schedule by ID",
		inputSchema: { id: z.string().describe("Schedule ID to remove") },
	},
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

server.registerTool(
	"update_schedule",
	{
		description:
			"Update an existing schedule's cron expression or prompt. All times are in KST (Asia/Seoul, UTC+9).",
		inputSchema: {
			id: z.string().describe("Schedule ID to update"),
			cronExpression: z
				.string()
				.optional()
				.describe(
					"New cron expression (minute hour dayOfMonth month dayOfWeek) in KST (Asia/Seoul, UTC+9)",
				),
			prompt: z.string().optional().describe("New prompt"),
		},
	},
	async ({ id, cronExpression, prompt }) => {
		try {
			const found = scheduler.update(id, { cronExpression, prompt });
			return {
				content: [
					{
						type: "text",
						text: found ? `Schedule ${id} updated` : `Schedule ${id} not found`,
					},
				],
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

server.registerTool(
	"enable_schedule",
	{
		description:
			"Enable a disabled cron schedule. Cron times are in KST (Asia/Seoul, UTC+9).",
		inputSchema: { id: z.string().describe("Schedule ID to enable") },
	},
	async ({ id }) => {
		const found = scheduler.enable(id);
		return {
			content: [
				{
					type: "text",
					text: found ? `Schedule ${id} enabled` : `Schedule ${id} not found`,
				},
			],
		};
	},
);

server.registerTool(
	"disable_schedule",
	{
		description:
			"Disable a cron schedule without removing it. Cron times are in KST (Asia/Seoul, UTC+9).",
		inputSchema: { id: z.string().describe("Schedule ID to disable") },
	},
	async ({ id }) => {
		const found = scheduler.disable(id);
		return {
			content: [
				{
					type: "text",
					text: found ? `Schedule ${id} disabled` : `Schedule ${id} not found`,
				},
			],
		};
	},
);

await server.connect(new StdioServerTransport());
