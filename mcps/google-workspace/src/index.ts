import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const server = new McpServer({
	name: "google-workspace",
	version: "0.0.1",
});

async function runGws(args: string[]): Promise<string> {
	const proc = Bun.spawn(["gws", ...args], {
		stdout: "pipe",
		stderr: "pipe",
		env: { ...process.env, GOOGLE_WORKSPACE_CLI_KEYRING_BACKEND: "keyring" },
	});
	const [stdout, stderr] = await Promise.all([
		new Response(proc.stdout).text(),
		new Response(proc.stderr).text(),
	]);
	const code = await proc.exited;
	if (code !== 0) {
		throw new Error(stderr || stdout || `gws exited with code ${code}`);
	}
	return stdout;
}

server.registerTool(
	"gws",
	{
		description: `Execute a Google Workspace CLI command. Supports all Google Workspace services: drive, sheets, gmail, calendar, docs, slides, tasks, people, chat, classroom, forms, keep, meet, events, script.

Usage pattern: gws <service> <resource> [sub-resource] <method>

Examples:
- drive files list --params '{"q": "name contains \\"report\\"", "pageSize": 10}'
- gmail users messages list --params '{"userId": "me", "maxResults": 5}'
- calendar events list --params '{"calendarId": "primary", "timeMin": "2026-01-01T00:00:00Z"}'
- sheets spreadsheets get --params '{"spreadsheetId": "..."}'
- tasks tasklists list
- drive files create --json '{"name": "test.txt", "mimeType": "text/plain"}' --upload /path/to/file

Use gws_schema tool first to discover available methods and parameters for a service.`,
		inputSchema: {
			command: z
				.string()
				.describe(
					'The gws command arguments (without the "gws" prefix). e.g. "drive files list --params {\\"pageSize\\": 10}"',
				),
		},
	},
	async ({ command }) => {
		try {
			const args = parseCommand(command);
			const result = await runGws(args);
			return { content: [{ type: "text", text: result }] };
		} catch (e: unknown) {
			const message = e instanceof Error ? e.message : String(e);
			return { content: [{ type: "text", text: message }], isError: true };
		}
	},
);

server.registerTool(
	"gws_schema",
	{
		description:
			"Look up the API schema for a Google Workspace method. Returns parameter definitions, required fields, and descriptions. Use this to discover how to call a specific API method.",
		inputSchema: {
			method: z
				.string()
				.describe(
					'The method path in dot notation. e.g. "drive.files.list", "gmail.users.messages.get", "calendar.events.insert"',
				),
			resolveRefs: z
				.boolean()
				.optional()
				.describe("Resolve $ref references in the schema (default: false)"),
		},
	},
	async ({ method, resolveRefs }) => {
		try {
			const args = ["schema", method];
			if (resolveRefs) args.push("--resolve-refs");
			const result = await runGws(args);
			return { content: [{ type: "text", text: result }] };
		} catch (e: unknown) {
			const message = e instanceof Error ? e.message : String(e);
			return { content: [{ type: "text", text: message }], isError: true };
		}
	},
);

server.registerTool(
	"gws_workflow",
	{
		description: `Run a cross-service Google Workspace workflow.

Available workflows:
- standup-report: Today's meetings + open tasks as a standup summary
- meeting-prep: Prepare for your next meeting: agenda, attendees, and linked docs
- email-to-task: Convert a Gmail message into a Google Tasks entry
- weekly-digest: Weekly summary: this week's meetings + unread email count
- file-announce: Announce a Drive file in a Chat space`,
		inputSchema: {
			workflow: z
				.enum([
					"standup-report",
					"meeting-prep",
					"email-to-task",
					"weekly-digest",
					"file-announce",
				])
				.describe("The workflow to run"),
			params: z
				.string()
				.optional()
				.describe("Additional params as JSON string"),
		},
	},
	async ({ workflow, params }) => {
		try {
			const args = ["workflow", `+${workflow}`];
			if (params) args.push("--params", params);
			const result = await runGws(args);
			return { content: [{ type: "text", text: result }] };
		} catch (e: unknown) {
			const message = e instanceof Error ? e.message : String(e);
			return { content: [{ type: "text", text: message }], isError: true };
		}
	},
);

function parseCommand(command: string): string[] {
	const args: string[] = [];
	let current = "";
	let inSingleQuote = false;
	let inDoubleQuote = false;
	let escaped = false;

	for (const char of command) {
		if (escaped) {
			current += char;
			escaped = false;
			continue;
		}
		if (char === "\\" && !inSingleQuote) {
			escaped = true;
			continue;
		}
		if (char === "'" && !inDoubleQuote) {
			inSingleQuote = !inSingleQuote;
			continue;
		}
		if (char === '"' && !inSingleQuote) {
			inDoubleQuote = !inDoubleQuote;
			continue;
		}
		if (char === " " && !inSingleQuote && !inDoubleQuote) {
			if (current) {
				args.push(current);
				current = "";
			}
			continue;
		}
		current += char;
	}
	if (current) args.push(current);
	return args;
}

await server.connect(new StdioServerTransport());
