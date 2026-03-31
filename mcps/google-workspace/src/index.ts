import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const server = new McpServer({
	name: "google-workspace",
	version: "0.0.2",
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
	const args = [service, ...command.split(/\s+/)];
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

// --- Drive ---
server.registerTool(
	"gws_drive",
	{
		description: `Google Drive: manage files, folders, and shared drives.

Common commands:
- "files list" with params {"q": "name contains 'report'", "pageSize": 10}
- "files get" with params {"fileId": "..."}
- "files create" with body {"name": "doc.txt", "mimeType": "text/plain"}
- "files copy" with params {"fileId": "..."} and body {"name": "copy.txt"}
- "files delete" with params {"fileId": "..."}
- "files export" with params {"fileId": "...", "mimeType": "application/pdf"}
- "permissions list" with params {"fileId": "..."}
- "permissions create" with params {"fileId": "..."} and body {"role": "reader", "type": "user", "emailAddress": "..."}

Use gws_schema with method like "drive.files.list" to see all parameters.`,
		inputSchema: {
			command: z
				.string()
				.describe(
					'Resource and method, e.g. "files list", "files get", "permissions create"',
				),
			params: paramsSchema,
			body: bodySchema,
			pageAll: pageAllSchema,
			pageLimit: pageLimitSchema,
			format: formatSchema,
		},
	},
	async ({ command, params, body, pageAll, pageLimit, format }) => {
		try {
			const result = await runGws(
				buildArgs("drive", command, params, body, {
					pageAll,
					pageLimit,
					format,
				}),
			);
			return ok(result);
		} catch (e) {
			return err(e);
		}
	},
);

// --- Gmail ---
server.registerTool(
	"gws_gmail",
	{
		description: `Gmail: send, read, and manage email.

Common commands:
- "users messages list" with params {"userId": "me", "maxResults": 10, "q": "is:unread"}
- "users messages get" with params {"userId": "me", "id": "..."}
- "users messages send" with params {"userId": "me"} and body {"raw": "base64-encoded-email"}
- "users messages modify" with params {"userId": "me", "id": "..."} and body {"removeLabelIds": ["UNREAD"]}
- "users messages trash" with params {"userId": "me", "id": "..."}
- "users labels list" with params {"userId": "me"}
- "users drafts list" with params {"userId": "me"}
- "users threads list" with params {"userId": "me", "q": "subject:meeting"}

Use gws_schema with method like "gmail.users.messages.list" to see all parameters.`,
		inputSchema: {
			command: z
				.string()
				.describe(
					'Resource and method, e.g. "users messages list", "users labels list"',
				),
			params: paramsSchema,
			body: bodySchema,
			pageAll: pageAllSchema,
			pageLimit: pageLimitSchema,
			format: formatSchema,
		},
	},
	async ({ command, params, body, pageAll, pageLimit, format }) => {
		try {
			const result = await runGws(
				buildArgs("gmail", command, params, body, {
					pageAll,
					pageLimit,
					format,
				}),
			);
			return ok(result);
		} catch (e) {
			return err(e);
		}
	},
);

// --- Calendar ---
server.registerTool(
	"gws_calendar",
	{
		description: `Google Calendar: manage calendars and events.

Common commands:
- "events list" with params {"calendarId": "primary", "timeMin": "2026-01-01T00:00:00Z", "maxResults": 10}
- "events get" with params {"calendarId": "primary", "eventId": "..."}
- "events insert" with params {"calendarId": "primary"} and body {"summary": "Meeting", "start": {"dateTime": "..."}, "end": {"dateTime": "..."}}
- "events update" with params {"calendarId": "primary", "eventId": "..."} and body {...}
- "events delete" with params {"calendarId": "primary", "eventId": "..."}
- "calendarList list"
- "calendarList get" with params {"calendarId": "..."}

Use gws_schema with method like "calendar.events.list" to see all parameters.`,
		inputSchema: {
			command: z
				.string()
				.describe(
					'Resource and method, e.g. "events list", "events insert", "calendarList list"',
				),
			params: paramsSchema,
			body: bodySchema,
			pageAll: pageAllSchema,
			pageLimit: pageLimitSchema,
			format: formatSchema,
		},
	},
	async ({ command, params, body, pageAll, pageLimit, format }) => {
		try {
			const result = await runGws(
				buildArgs("calendar", command, params, body, {
					pageAll,
					pageLimit,
					format,
				}),
			);
			return ok(result);
		} catch (e) {
			return err(e);
		}
	},
);

// --- Sheets ---
server.registerTool(
	"gws_sheets",
	{
		description: `Google Sheets: read and write spreadsheets.

Common commands:
- "spreadsheets get" with params {"spreadsheetId": "..."}
- "spreadsheets create" with body {"properties": {"title": "My Sheet"}}
- "spreadsheets values get" with params {"spreadsheetId": "...", "range": "Sheet1!A1:D10"}
- "spreadsheets values update" with params {"spreadsheetId": "...", "range": "Sheet1!A1", "valueInputOption": "USER_ENTERED"} and body {"values": [["a","b"],["c","d"]]}
- "spreadsheets values append" with params {"spreadsheetId": "...", "range": "Sheet1", "valueInputOption": "USER_ENTERED"} and body {"values": [["new row"]]}
- "spreadsheets batchUpdate" with params {"spreadsheetId": "..."} and body {"requests": [...]}

Use gws_schema with method like "sheets.spreadsheets.values.get" to see all parameters.`,
		inputSchema: {
			command: z
				.string()
				.describe(
					'Resource and method, e.g. "spreadsheets get", "spreadsheets values get"',
				),
			params: paramsSchema,
			body: bodySchema,
			format: formatSchema,
		},
	},
	async ({ command, params, body, format }) => {
		try {
			const result = await runGws(
				buildArgs("sheets", command, params, body, { format }),
			);
			return ok(result);
		} catch (e) {
			return err(e);
		}
	},
);

// --- Docs ---
server.registerTool(
	"gws_docs",
	{
		description: `Google Docs: read and write documents.

Common commands:
- "documents get" with params {"documentId": "..."}
- "documents create" with body {"title": "My Doc"}
- "documents batchUpdate" with params {"documentId": "..."} and body {"requests": [...]}

Use gws_schema with method like "docs.documents.get" to see all parameters.`,
		inputSchema: {
			command: z
				.string()
				.describe(
					'Resource and method, e.g. "documents get", "documents create"',
				),
			params: paramsSchema,
			body: bodySchema,
			format: formatSchema,
		},
	},
	async ({ command, params, body, format }) => {
		try {
			const result = await runGws(
				buildArgs("docs", command, params, body, { format }),
			);
			return ok(result);
		} catch (e) {
			return err(e);
		}
	},
);

// --- Slides ---
server.registerTool(
	"gws_slides",
	{
		description: `Google Slides: read and write presentations.

Common commands:
- "presentations get" with params {"presentationId": "..."}
- "presentations create" with body {"title": "My Slides"}
- "presentations batchUpdate" with params {"presentationId": "..."} and body {"requests": [...]}
- "presentations pages get" with params {"presentationId": "...", "pageObjectId": "..."}

Use gws_schema with method like "slides.presentations.get" to see all parameters.`,
		inputSchema: {
			command: z
				.string()
				.describe(
					'Resource and method, e.g. "presentations get", "presentations create"',
				),
			params: paramsSchema,
			body: bodySchema,
			format: formatSchema,
		},
	},
	async ({ command, params, body, format }) => {
		try {
			const result = await runGws(
				buildArgs("slides", command, params, body, { format }),
			);
			return ok(result);
		} catch (e) {
			return err(e);
		}
	},
);

// --- Tasks ---
server.registerTool(
	"gws_tasks",
	{
		description: `Google Tasks: manage task lists and tasks.

Common commands:
- "tasklists list"
- "tasklists get" with params {"tasklist": "..."}
- "tasklists insert" with body {"title": "My List"}
- "tasks list" with params {"tasklist": "..."}
- "tasks get" with params {"tasklist": "...", "task": "..."}
- "tasks insert" with params {"tasklist": "..."} and body {"title": "Buy groceries", "notes": "..."}
- "tasks patch" with params {"tasklist": "...", "task": "..."} and body {"status": "completed"}
- "tasks delete" with params {"tasklist": "...", "task": "..."}

Use gws_schema with method like "tasks.tasks.list" to see all parameters.`,
		inputSchema: {
			command: z
				.string()
				.describe(
					'Resource and method, e.g. "tasklists list", "tasks list", "tasks insert"',
				),
			params: paramsSchema,
			body: bodySchema,
			pageAll: pageAllSchema,
			format: formatSchema,
		},
	},
	async ({ command, params, body, pageAll, format }) => {
		try {
			const result = await runGws(
				buildArgs("tasks", command, params, body, { pageAll, format }),
			);
			return ok(result);
		} catch (e) {
			return err(e);
		}
	},
);

// --- People ---
server.registerTool(
	"gws_people",
	{
		description: `Google People/Contacts: manage contacts and profiles.

Common commands:
- "people connections list" with params {"resourceName": "people/me", "personFields": "names,emailAddresses,phoneNumbers"}
- "people get" with params {"resourceName": "people/...", "personFields": "names,emailAddresses"}
- "people searchContacts" with params {"query": "John", "readMask": "names,emailAddresses"}
- "people createContact" with body {"names": [{"givenName": "John"}], "emailAddresses": [{"value": "john@example.com"}]}
- "contactGroups list"

Use gws_schema with method like "people.people.connections.list" to see all parameters.`,
		inputSchema: {
			command: z
				.string()
				.describe(
					'Resource and method, e.g. "people connections list", "people searchContacts"',
				),
			params: paramsSchema,
			body: bodySchema,
			pageAll: pageAllSchema,
			format: formatSchema,
		},
	},
	async ({ command, params, body, pageAll, format }) => {
		try {
			const result = await runGws(
				buildArgs("people", command, params, body, { pageAll, format }),
			);
			return ok(result);
		} catch (e) {
			return err(e);
		}
	},
);

// --- Chat ---
server.registerTool(
	"gws_chat",
	{
		description: `Google Chat: manage Chat spaces and messages.

Common commands:
- "spaces list"
- "spaces get" with params {"name": "spaces/..."}
- "spaces messages list" with params {"parent": "spaces/..."}
- "spaces messages create" with params {"parent": "spaces/..."} and body {"text": "Hello!"}
- "spaces messages get" with params {"name": "spaces/.../messages/..."}
- "spaces members list" with params {"parent": "spaces/..."}

Use gws_schema with method like "chat.spaces.messages.create" to see all parameters.`,
		inputSchema: {
			command: z
				.string()
				.describe(
					'Resource and method, e.g. "spaces list", "spaces messages create"',
				),
			params: paramsSchema,
			body: bodySchema,
			pageAll: pageAllSchema,
			format: formatSchema,
		},
	},
	async ({ command, params, body, pageAll, format }) => {
		try {
			const result = await runGws(
				buildArgs("chat", command, params, body, { pageAll, format }),
			);
			return ok(result);
		} catch (e) {
			return err(e);
		}
	},
);

// --- Forms ---
server.registerTool(
	"gws_forms",
	{
		description: `Google Forms: read and write forms.

Common commands:
- "forms get" with params {"formId": "..."}
- "forms create" with body {"info": {"title": "Survey"}}
- "forms batchUpdate" with params {"formId": "..."} and body {"requests": [...]}
- "forms responses list" with params {"formId": "..."}
- "forms responses get" with params {"formId": "...", "responseId": "..."}

Use gws_schema with method like "forms.forms.get" to see all parameters.`,
		inputSchema: {
			command: z
				.string()
				.describe(
					'Resource and method, e.g. "forms get", "forms responses list"',
				),
			params: paramsSchema,
			body: bodySchema,
			pageAll: pageAllSchema,
			format: formatSchema,
		},
	},
	async ({ command, params, body, pageAll, format }) => {
		try {
			const result = await runGws(
				buildArgs("forms", command, params, body, { pageAll, format }),
			);
			return ok(result);
		} catch (e) {
			return err(e);
		}
	},
);

// --- Keep ---
server.registerTool(
	"gws_keep",
	{
		description: `Google Keep: manage notes.

Common commands:
- "notes list"
- "notes get" with params {"name": "notes/..."}
- "notes create" with body {"title": "Note", "body": {"text": {"text": "content"}}}
- "notes delete" with params {"name": "notes/..."}

Use gws_schema with method like "keep.notes.list" to see all parameters.`,
		inputSchema: {
			command: z
				.string()
				.describe('Resource and method, e.g. "notes list", "notes get"'),
			params: paramsSchema,
			body: bodySchema,
			format: formatSchema,
		},
	},
	async ({ command, params, body, format }) => {
		try {
			const result = await runGws(
				buildArgs("keep", command, params, body, { format }),
			);
			return ok(result);
		} catch (e) {
			return err(e);
		}
	},
);

// --- Meet ---
server.registerTool(
	"gws_meet",
	{
		description: `Google Meet: manage conferences.

Common commands:
- "spaces get" with params {"name": "spaces/..."}
- "spaces create" with body {"config": {"accessType": "OPEN"}}
- "conferenceRecords list"
- "conferenceRecords get" with params {"name": "conferenceRecords/..."}
- "conferenceRecords participants list" with params {"parent": "conferenceRecords/..."}

Use gws_schema with method like "meet.spaces.create" to see all parameters.`,
		inputSchema: {
			command: z
				.string()
				.describe(
					'Resource and method, e.g. "spaces create", "conferenceRecords list"',
				),
			params: paramsSchema,
			body: bodySchema,
			format: formatSchema,
		},
	},
	async ({ command, params, body, format }) => {
		try {
			const result = await runGws(
				buildArgs("meet", command, params, body, { format }),
			);
			return ok(result);
		} catch (e) {
			return err(e);
		}
	},
);

// --- Classroom ---
server.registerTool(
	"gws_classroom",
	{
		description: `Google Classroom: manage classes, rosters, and coursework.

Common commands:
- "courses list"
- "courses get" with params {"id": "..."}
- "courses create" with body {"name": "Math 101", "section": "Period 1"}
- "courses courseWork list" with params {"courseId": "..."}
- "courses students list" with params {"courseId": "..."}

Use gws_schema with method like "classroom.courses.list" to see all parameters.`,
		inputSchema: {
			command: z
				.string()
				.describe(
					'Resource and method, e.g. "courses list", "courses courseWork list"',
				),
			params: paramsSchema,
			body: bodySchema,
			pageAll: pageAllSchema,
			format: formatSchema,
		},
	},
	async ({ command, params, body, pageAll, format }) => {
		try {
			const result = await runGws(
				buildArgs("classroom", command, params, body, { pageAll, format }),
			);
			return ok(result);
		} catch (e) {
			return err(e);
		}
	},
);

// --- Apps Script ---
server.registerTool(
	"gws_script",
	{
		description: `Google Apps Script: manage script projects.

Common commands:
- "projects get" with params {"scriptId": "..."}
- "projects create" with body {"title": "My Script"}
- "projects getContent" with params {"scriptId": "..."}
- "projects updateContent" with params {"scriptId": "..."} and body {"files": [...]}
- "processes list"

Use gws_schema with method like "script.projects.get" to see all parameters.`,
		inputSchema: {
			command: z
				.string()
				.describe(
					'Resource and method, e.g. "projects get", "projects create"',
				),
			params: paramsSchema,
			body: bodySchema,
			format: formatSchema,
		},
	},
	async ({ command, params, body, format }) => {
		try {
			const result = await runGws(
				buildArgs("script", command, params, body, { format }),
			);
			return ok(result);
		} catch (e) {
			return err(e);
		}
	},
);

// --- Admin Reports ---
server.registerTool(
	"gws_admin_reports",
	{
		description: `Google Admin Reports: audit logs and usage reports.

Common commands:
- "activities list" with params {"userKey": "all", "applicationName": "login"}
- "activities list" with params {"userKey": "all", "applicationName": "admin"}
- "userUsageReport get" with params {"userKey": "all", "date": "2026-03-01"}
- "customerUsageReports get" with params {"date": "2026-03-01"}

Use gws_schema with method like "admin-reports.activities.list" to see all parameters.`,
		inputSchema: {
			command: z
				.string()
				.describe(
					'Resource and method, e.g. "activities list", "userUsageReport get"',
				),
			params: paramsSchema,
			pageAll: pageAllSchema,
			format: formatSchema,
		},
	},
	async ({ command, params, pageAll, format }) => {
		try {
			const result = await runGws(
				buildArgs("admin-reports", command, params, undefined, {
					pageAll,
					format,
				}),
			);
			return ok(result);
		} catch (e) {
			return err(e);
		}
	},
);

// --- Schema lookup (cross-service) ---
server.registerTool(
	"gws_schema",
	{
		description:
			"Look up the API schema for any Google Workspace method. Returns parameter definitions, required fields, and descriptions. Use this to discover how to call a specific API method before making calls.",
		inputSchema: {
			method: z
				.string()
				.describe(
					'Method path in dot notation, e.g. "drive.files.list", "gmail.users.messages.get", "calendar.events.insert", "sheets.spreadsheets.values.get"',
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
			return ok(result);
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
			const result = await runGws(args);
			return ok(result);
		} catch (e) {
			return err(e);
		}
	},
);

await server.connect(new StdioServerTransport());
