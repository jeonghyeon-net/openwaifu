// Playwright는 Bun 런타임과 호환되지 않으므로 Node.js로 직접 실행
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

const home = process.env["HOME"] ?? "";

function find(name: string, extras: string[]): string {
	for (const dir of (process.env["PATH"] ?? "").split(":")) {
		const p = join(dir, name);
		if (existsSync(p)) return p;
	}
	for (const p of extras) {
		if (existsSync(p)) return p;
	}
	throw new Error(`${name}를 찾을 수 없습니다`);
}

const node = find("node", [
	join(home, ".local/share/mise/shims/node"),
	"/opt/homebrew/bin/node",
	"/usr/local/bin/node",
]);

const cliPath = new URL("cli.js", import.meta.resolve("@playwright/mcp"))
	.pathname;

// stdin/stdout 패스스루로 MCP stdio 프로토콜 유지
execFileSync(node, [cliPath], { stdio: "inherit" });
