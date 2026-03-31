import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const server = new McpServer({
	name: "google-workspace",
	version: "0.1.0",
	description:
		"Pre-authenticated Google Workspace tools. No OAuth setup or API keys needed — just call the tools directly.",
});

const TIMEOUT_MS = 30_000;

function findGws(): string {
	const candidates = [
		process.env["GWS_BINARY_PATH"],
		"/opt/homebrew/bin/gws",
		"/usr/local/bin/gws",
	];
	for (const p of candidates) {
		if (p && Bun.which(p)) return p;
	}
	const fromPath = Bun.which("gws");
	if (fromPath) return fromPath;
	throw new Error(
		"gws binary not found. Install it: brew install googleworkspace-cli",
	);
}

const gwsBinary = findGws();

async function runGws(args: string[]): Promise<string> {
	const proc = Bun.spawn([gwsBinary, ...args], {
		stdout: "pipe",
		stderr: "pipe",
		env: { ...process.env, GOOGLE_WORKSPACE_CLI_KEYRING_BACKEND: "keyring" },
	});
	let timedOut = false;
	const timer = setTimeout(() => {
		timedOut = true;
		proc.kill();
	}, TIMEOUT_MS);
	const [stdout, stderr] = await Promise.all([
		new Response(proc.stdout).text(),
		new Response(proc.stderr).text(),
	]);
	const code = await proc.exited;
	clearTimeout(timer);
	if (timedOut) {
		throw new Error(`gws command timed out after ${TIMEOUT_MS / 1000}s`);
	}
	if (code !== 0) {
		throw new Error(stderr || stdout || `gws exited with code ${code}`);
	}
	return stdout || "(no output)";
}

function validateCommand(command: string): string[] {
	const parts = command.split(/\s+/).filter(Boolean);
	for (const part of parts) {
		if (part.startsWith("-")) {
			throw new Error(
				`Invalid command: flags (${part}) are not allowed in the command field. Use the params/body/format/pageAll fields instead.`,
			);
		}
	}
	return parts;
}

function buildArgs(
	service: string,
	command: string,
	params: string | undefined,
	body: string | undefined,
	options: {
		pageAll?: boolean | undefined;
		pageLimit?: number | undefined;
		format?: string | undefined;
	},
): string[] {
	const args = [service, ...validateCommand(command)];
	if (params) args.push("--params", params);
	if (body) args.push("--json", body);
	if (options.pageAll) args.push("--page-all");
	if (options.pageLimit) args.push("--page-limit", String(options.pageLimit));
	if (options.format) args.push("--format", options.format);
	return args;
}

function ok(text: string) {
	return { content: [{ type: "text" as const, text }] };
}

function err(e: unknown) {
	const message = e instanceof Error ? e.message : String(e);
	return { content: [{ type: "text" as const, text: message }], isError: true };
}

// --- Service tool definitions ---

interface ServiceDef {
	service: string;
	description: string;
	commandHint: string;
	hasBody: boolean;
	hasPageAll: boolean;
	hasPageLimit: boolean;
}

const services: ServiceDef[] = [
	{
		service: "drive",
		description: `Google Drive: manage files, folders, and shared drives.

Common commands:
- "files list" with params {"q": "name contains 'report'", "pageSize": 10}
- "files get" with params {"fileId": "..."}
- "files create" with body {"name": "doc.txt", "mimeType": "text/plain"}
- "files delete" with params {"fileId": "..."}
- "permissions create" with params {"fileId": "..."} and body {"role": "reader", "type": "user", "emailAddress": "..."}

Use gws_schema with method like "drive.files.list" to see all parameters.`,
		commandHint:
			'Resource and method, e.g. "files list", "files get", "permissions create"',
		hasBody: true,
		hasPageAll: true,
		hasPageLimit: true,
	},
	{
		service: "gmail",
		description: `Gmail: send, read, and manage email.

Common commands:
- "users messages list" with params {"userId": "me", "maxResults": 10, "q": "is:unread"}
- "users messages get" with params {"userId": "me", "id": "..."}
- "users messages send" with params {"userId": "me"} and body {"raw": "base64-encoded-email"}
- "users labels list" with params {"userId": "me"}
- "users threads list" with params {"userId": "me", "q": "subject:meeting"}

Use gws_schema with method like "gmail.users.messages.list" to see all parameters.`,
		commandHint:
			'Resource and method, e.g. "users messages list", "users labels list"',
		hasBody: true,
		hasPageAll: true,
		hasPageLimit: true,
	},
	{
		service: "calendar",
		description: `Google Calendar: manage calendars and events.

Common commands:
- "events list" with params {"calendarId": "primary", "timeMin": "2026-01-01T00:00:00Z", "maxResults": 10}
- "events insert" with params {"calendarId": "primary"} and body {"summary": "Meeting", "start": {"dateTime": "..."}, "end": {"dateTime": "..."}}
- "events delete" with params {"calendarId": "primary", "eventId": "..."}
- "calendarList list"

Use gws_schema with method like "calendar.events.list" to see all parameters.`,
		commandHint:
			'Resource and method, e.g. "events list", "events insert", "calendarList list"',
		hasBody: true,
		hasPageAll: true,
		hasPageLimit: true,
	},
	{
		service: "sheets",
		description: `Google Sheets: read and write spreadsheets.

Common commands:
- "spreadsheets get" with params {"spreadsheetId": "..."}
- "spreadsheets values get" with params {"spreadsheetId": "...", "range": "Sheet1!A1:D10"}
- "spreadsheets values update" with params {"spreadsheetId": "...", "range": "Sheet1!A1", "valueInputOption": "USER_ENTERED"} and body {"values": [["a","b"]]}

Use gws_schema with method like "sheets.spreadsheets.values.get" to see all parameters.`,
		commandHint:
			'Resource and method, e.g. "spreadsheets get", "spreadsheets values get"',
		hasBody: true,
		hasPageAll: false,
		hasPageLimit: false,
	},
	{
		service: "docs",
		description: `Google Docs: read and write documents.

Common commands:
- "documents get" with params {"documentId": "..."}
- "documents create" with body {"title": "My Doc"}
- "documents batchUpdate" with params {"documentId": "..."} and body {"requests": [...]}

Use gws_schema with method like "docs.documents.get" to see all parameters.`,
		commandHint:
			'Resource and method, e.g. "documents get", "documents create"',
		hasBody: true,
		hasPageAll: false,
		hasPageLimit: false,
	},
	{
		service: "slides",
		description: `Google Slides: read and write presentations.

Common commands:
- "presentations get" with params {"presentationId": "..."}
- "presentations create" with body {"title": "My Slides"}
- "presentations batchUpdate" with params {"presentationId": "..."} and body {"requests": [...]}

Use gws_schema with method like "slides.presentations.get" to see all parameters.`,
		commandHint:
			'Resource and method, e.g. "presentations get", "presentations create"',
		hasBody: true,
		hasPageAll: false,
		hasPageLimit: false,
	},
	{
		service: "tasks",
		description: `Google Tasks: manage task lists and tasks.

Common commands:
- "tasklists list"
- "tasks list" with params {"tasklist": "..."}
- "tasks insert" with params {"tasklist": "..."} and body {"title": "Buy groceries"}
- "tasks patch" with params {"tasklist": "...", "task": "..."} and body {"status": "completed"}

Use gws_schema with method like "tasks.tasks.list" to see all parameters.`,
		commandHint:
			'Resource and method, e.g. "tasklists list", "tasks list", "tasks insert"',
		hasBody: true,
		hasPageAll: true,
		hasPageLimit: false,
	},
	{
		service: "people",
		description: `Google People/Contacts: manage contacts and profiles.

Common commands:
- "people connections list" with params {"resourceName": "people/me", "personFields": "names,emailAddresses"}
- "people searchContacts" with params {"query": "John", "readMask": "names,emailAddresses"}
- "people createContact" with body {"names": [{"givenName": "John"}], "emailAddresses": [{"value": "john@example.com"}]}

Use gws_schema with method like "people.people.connections.list" to see all parameters.`,
		commandHint:
			'Resource and method, e.g. "people connections list", "people searchContacts"',
		hasBody: true,
		hasPageAll: true,
		hasPageLimit: false,
	},
	{
		service: "chat",
		description: `Google Chat: manage Chat spaces and messages.

Common commands:
- "spaces list"
- "spaces messages list" with params {"parent": "spaces/..."}
- "spaces messages create" with params {"parent": "spaces/..."} and body {"text": "Hello!"}

Use gws_schema with method like "chat.spaces.messages.create" to see all parameters.`,
		commandHint:
			'Resource and method, e.g. "spaces list", "spaces messages create"',
		hasBody: true,
		hasPageAll: true,
		hasPageLimit: false,
	},
	{
		service: "forms",
		description: `Google Forms: read and write forms.

Common commands:
- "forms get" with params {"formId": "..."}
- "forms create" with body {"info": {"title": "Survey"}}
- "forms responses list" with params {"formId": "..."}

Use gws_schema with method like "forms.forms.get" to see all parameters.`,
		commandHint:
			'Resource and method, e.g. "forms get", "forms responses list"',
		hasBody: true,
		hasPageAll: true,
		hasPageLimit: false,
	},
	{
		service: "keep",
		description: `Google Keep: manage notes.

Common commands:
- "notes list"
- "notes get" with params {"name": "notes/..."}
- "notes create" with body {"title": "Note", "body": {"text": {"text": "content"}}}

Use gws_schema with method like "keep.notes.list" to see all parameters.`,
		commandHint: 'Resource and method, e.g. "notes list", "notes get"',
		hasBody: true,
		hasPageAll: false,
		hasPageLimit: false,
	},
	{
		service: "meet",
		description: `Google Meet: manage conferences.

Common commands:
- "spaces create" with body {"config": {"accessType": "OPEN"}}
- "conferenceRecords list"
- "conferenceRecords participants list" with params {"parent": "conferenceRecords/..."}

Use gws_schema with method like "meet.spaces.create" to see all parameters.`,
		commandHint:
			'Resource and method, e.g. "spaces create", "conferenceRecords list"',
		hasBody: true,
		hasPageAll: false,
		hasPageLimit: false,
	},
	{
		service: "classroom",
		description: `Google Classroom: manage classes, rosters, and coursework.

Common commands:
- "courses list"
- "courses create" with body {"name": "Math 101", "section": "Period 1"}
- "courses courseWork list" with params {"courseId": "..."}
- "courses students list" with params {"courseId": "..."}

Use gws_schema with method like "classroom.courses.list" to see all parameters.`,
		commandHint:
			'Resource and method, e.g. "courses list", "courses courseWork list"',
		hasBody: true,
		hasPageAll: true,
		hasPageLimit: false,
	},
	{
		service: "script",
		description: `Google Apps Script: manage script projects.

Common commands:
- "projects get" with params {"scriptId": "..."}
- "projects create" with body {"title": "My Script"}
- "projects getContent" with params {"scriptId": "..."}
- "processes list"

Use gws_schema with method like "script.projects.get" to see all parameters.`,
		commandHint: 'Resource and method, e.g. "projects get", "projects create"',
		hasBody: true,
		hasPageAll: false,
		hasPageLimit: false,
	},
	{
		service: "admin-reports",
		description: `Google Admin Reports: audit logs and usage reports.

Common commands:
- "activities list" with params {"userKey": "all", "applicationName": "login"}
- "userUsageReport get" with params {"userKey": "all", "date": "2026-03-01"}
- "customerUsageReports get" with params {"date": "2026-03-01"}

Use gws_schema with method like "admin-reports.activities.list" to see all parameters.`,
		commandHint:
			'Resource and method, e.g. "activities list", "userUsageReport get"',
		hasBody: false,
		hasPageAll: true,
		hasPageLimit: false,
	},
];

// Register all service tools via loop
const paramsSchema = z
	.string()
	.optional()
	.describe("URL/query parameters as JSON string");
const bodySchema = z
	.string()
	.optional()
	.describe("Request body as JSON string (for POST/PATCH/PUT)");
const pageAllSchema = z
	.boolean()
	.optional()
	.describe("Auto-paginate all results");
const pageLimitSchema = z
	.number()
	.optional()
	.describe("Max pages to fetch (default: 10)");
const formatSchema = z
	.enum(["json", "table", "yaml", "csv"])
	.optional()
	.describe("Output format (default: json)");

for (const svc of services) {
	const toolName = `gws_${svc.service.replaceAll("-", "_")}`;
	const schema: Record<string, z.ZodTypeAny> = {
		command: z.string().describe(svc.commandHint),
		params: paramsSchema,
	};
	if (svc.hasBody) schema["body"] = bodySchema;
	if (svc.hasPageAll) schema["pageAll"] = pageAllSchema;
	if (svc.hasPageLimit) schema["pageLimit"] = pageLimitSchema;
	schema["format"] = formatSchema;

	server.registerTool(
		toolName,
		{ description: svc.description, inputSchema: schema },
		async (args) => {
			try {
				const result = await runGws(
					buildArgs(
						svc.service,
						args["command"] as string,
						args["params"] as string | undefined,
						args["body"] as string | undefined,
						{
							pageAll: args["pageAll"] as boolean | undefined,
							pageLimit: args["pageLimit"] as number | undefined,
							format: args["format"] as string | undefined,
						},
					),
				);
				return ok(result);
			} catch (e) {
				return err(e);
			}
		},
	);
}

// --- Schema lookup (cross-service) ---
server.registerTool(
	"gws_schema",
	{
		description:
			"Look up the API schema for any Google Workspace method. Returns parameter definitions, required fields, and descriptions.",
		inputSchema: {
			method: z
				.string()
				.describe(
					'Method path in dot notation, e.g. "drive.files.list", "gmail.users.messages.get"',
				),
			resolveRefs: z
				.boolean()
				.optional()
				.describe("Resolve $ref references in the schema"),
		},
	},
	async ({ method, resolveRefs }) => {
		try {
			validateCommand(method);
			const args = ["schema", method];
			if (resolveRefs) args.push("--resolve-refs");
			return ok(await runGws(args));
		} catch (e) {
			return err(e);
		}
	},
);

// --- Workflow (cross-service) ---
server.registerTool(
	"gws_workflow",
	{
		description: `Run a cross-service Google Workspace productivity workflow.

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
			return ok(await runGws(args));
		} catch (e) {
			return err(e);
		}
	},
);

await server.connect(new StdioServerTransport());
