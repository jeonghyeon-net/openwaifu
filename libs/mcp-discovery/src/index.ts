import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import type { McpServerConfig } from "@lib/llm";

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

export function discoverMcpServers(): Record<string, McpServerConfig> {
	const root = findWorkspaceRoot(process.cwd());
	const mcpsDir = join(root, "mcps");
	const servers: Record<string, McpServerConfig> = {};

	let dirs: string[];
	try {
		dirs = readdirSync(mcpsDir, { withFileTypes: true })
			.filter((d) => d.isDirectory())
			.map((d) => d.name);
	} catch {
		return {};
	}

	for (const dir of dirs) {
		const pkgPath = join(mcpsDir, dir, "package.json");
		try {
			const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
			const entryPoint =
				typeof pkg.exports === "string" ? pkg.exports : pkg.exports?.["."];

			if (typeof entryPoint !== "string") continue;

			servers[dir] = {
				command: "bun",
				args: ["run", join(mcpsDir, dir, entryPoint)],
			};
		} catch {
			// skip packages without valid exports
		}
	}

	return servers;
}
