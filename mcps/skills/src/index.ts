import {
	existsSync,
	mkdirSync,
	readdirSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";
import { findWorkspaceRoot } from "@lib/env";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const root = findWorkspaceRoot();
const skillsDir = join(root, "skills");

function safeName(name: string): string {
	const resolved = resolve(skillsDir, name);
	if (!resolved.startsWith(skillsDir + "/")) {
		throw new Error("Invalid skill name");
	}
	return name;
}

function skillPath(name: string): string {
	return join(skillsDir, safeName(name), "SKILL.md");
}

function buildSkillMd(
	name: string,
	description: string,
	content: string,
): string {
	return `---\nname: ${name}\ndescription: "${description}"\n---\n\n${content}\n`;
}

function parseFrontmatter(md: string): {
	name: string;
	description: string;
	content: string;
} {
	const match = md.match(/^---\n([\s\S]*?)\n---\n\n?([\s\S]*)$/);
	if (!match) return { name: "", description: "", content: md };
	const meta = match[1] ?? "";
	const nameMatch = meta.match(/name:\s*(.+)/);
	const descMatch = meta.match(/description:\s*"?([^"]*)"?/);
	return {
		name: nameMatch?.[1]?.trim() ?? "",
		description: descMatch?.[1]?.trim() ?? "",
		content: (match[2] ?? "").trim(),
	};
}

const server = new McpServer({ name: "skills", version: "0.0.1" });

server.registerTool(
	"create_skill",
	{
		description: "Create a new skill",
		inputSchema: {
			name: z.string().describe("Skill name (used as directory name)"),
			description: z.string().describe("One-line description"),
			content: z.string().describe("Skill body (markdown)"),
		},
	},
	async ({ name, description, content }) => {
		try {
			const dir = join(skillsDir, safeName(name));
			if (existsSync(dir)) {
				return {
					content: [{ type: "text", text: `Skill "${name}" already exists` }],
					isError: true,
				};
			}
			mkdirSync(dir, { recursive: true });
			writeFileSync(skillPath(name), buildSkillMd(name, description, content));
			return {
				content: [{ type: "text", text: `Created skill "${name}"` }],
			};
		} catch (e: unknown) {
			const message = e instanceof Error ? e.message : String(e);
			return { content: [{ type: "text", text: message }], isError: true };
		}
	},
);

server.registerTool(
	"update_skill",
	{
		description: "Update an existing skill",
		inputSchema: {
			name: z.string().describe("Skill name"),
			description: z.string().optional().describe("New description"),
			content: z.string().optional().describe("New content"),
		},
	},
	async ({ name, description, content }) => {
		try {
			const path = skillPath(name);
			if (!existsSync(path)) {
				return {
					content: [{ type: "text", text: `Skill "${name}" not found` }],
					isError: true,
				};
			}
			const existing = parseFrontmatter(readFileSync(path, "utf-8"));
			writeFileSync(
				path,
				buildSkillMd(
					name,
					description ?? existing.description,
					content ?? existing.content,
				),
			);
			return {
				content: [{ type: "text", text: `Updated skill "${name}"` }],
			};
		} catch (e: unknown) {
			const message = e instanceof Error ? e.message : String(e);
			return { content: [{ type: "text", text: message }], isError: true };
		}
	},
);

server.registerTool(
	"delete_skill",
	{
		description: "Delete a skill",
		inputSchema: {
			name: z.string().describe("Skill name to delete"),
		},
	},
	async ({ name }) => {
		try {
			const dir = join(skillsDir, safeName(name));
			if (!existsSync(dir)) {
				return {
					content: [{ type: "text", text: `Skill "${name}" not found` }],
					isError: true,
				};
			}
			rmSync(dir, { recursive: true });
			return {
				content: [{ type: "text", text: `Deleted skill "${name}"` }],
			};
		} catch (e: unknown) {
			const message = e instanceof Error ? e.message : String(e);
			return { content: [{ type: "text", text: message }], isError: true };
		}
	},
);

server.registerTool(
	"list_skills",
	{ description: "List all skills" },
	async () => {
		try {
			if (!existsSync(skillsDir))
				return { content: [{ type: "text", text: "[]" }] };
			const dirs = readdirSync(skillsDir, { withFileTypes: true }).filter((d) =>
				d.isDirectory(),
			);
			const skills = dirs.map((d) => {
				const path = skillPath(d.name);
				if (!existsSync(path)) return { name: d.name, description: "" };
				const { description } = parseFrontmatter(readFileSync(path, "utf-8"));
				return { name: d.name, description };
			});
			return {
				content: [{ type: "text", text: JSON.stringify(skills, null, 2) }],
			};
		} catch (e: unknown) {
			const message = e instanceof Error ? e.message : String(e);
			return { content: [{ type: "text", text: message }], isError: true };
		}
	},
);

await server.connect(new StdioServerTransport());
