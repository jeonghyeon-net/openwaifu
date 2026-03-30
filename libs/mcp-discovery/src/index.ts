import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { findWorkspaceRoot } from "@lib/env";
import type { McpServerConfig } from "@lib/llm";

export function discoverMcpServers(): Record<string, McpServerConfig> {
	const root = findWorkspaceRoot();
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
