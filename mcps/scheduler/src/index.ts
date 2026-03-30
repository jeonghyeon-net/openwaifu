import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { Scheduler } from "@lib/scheduler";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

function findWorkspaceRoot(from: string): string {
	let dir = resolve(from);
	while (dir !== dirname(dir)) {
		const pkgPath = join(dir, "package.json");
		if (existsSync(pkgPath)) {
			const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
			if (pkg.workspaces) return dir;
		}
		dir = dirname(dir);
	}
	throw new Error("Workspace root not found");
}

const root = findWorkspaceRoot(process.cwd());
const dbPath = join(root, "scheduler.db");
const scheduler = new Scheduler(dbPath);

const server = new McpServer({
	name: "scheduler",
	version: "0.0.1",
});

server.tool(
	"add_schedule",
	"Create a new cron schedule. The prompt will be sent to the LLM when the cron expression matches. Format: minute hour dayOfMonth month dayOfWeek (e.g. '0 9 * * *' for every day at 9am, '*/5 * * * *' for every 5 minutes).",
	{
		cronExpression: z
			.string()
			.describe(
				"Cron expression (5 fields: minute hour dayOfMonth month dayOfWeek)",
			),
		prompt: z.string().describe("The prompt to send to the LLM when triggered"),
		channelId: z
			.string()
			.describe("The channel ID where the response should be sent"),
		createdBy: z.string().describe("User ID of the creator"),
	},
	async ({ cronExpression, prompt, channelId, createdBy }) => {
		const id = scheduler.add({ cronExpression, prompt, channelId, createdBy });
		return {
			content: [{ type: "text", text: `Schedule created with id: ${id}` }],
		};
	},
);

server.tool(
	"list_schedules",
	"List all cron schedules. Returns each schedule's id, cron expression, prompt, channel, creator, and enabled status.",
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
	"Remove a cron schedule by its ID.",
	{
		id: z.string().describe("The schedule ID to remove"),
	},
	async ({ id }) => {
		const removed = scheduler.remove(id);
		if (!removed) {
			return {
				content: [{ type: "text", text: `Schedule ${id} not found` }],
				isError: true,
			};
		}
		return {
			content: [{ type: "text", text: `Schedule ${id} removed` }],
		};
	},
);

server.tool(
	"enable_schedule",
	"Enable a cron schedule by its ID so it will trigger on its cron expression.",
	{
		id: z.string().describe("The schedule ID to enable"),
	},
	async ({ id }) => {
		scheduler.enable(id);
		return {
			content: [{ type: "text", text: `Schedule ${id} enabled` }],
		};
	},
);

server.tool(
	"disable_schedule",
	"Disable a cron schedule by its ID so it will no longer trigger.",
	{
		id: z.string().describe("The schedule ID to disable"),
	},
	async ({ id }) => {
		scheduler.disable(id);
		return {
			content: [{ type: "text", text: `Schedule ${id} disabled` }],
		};
	},
);

await server.connect(new StdioServerTransport());
