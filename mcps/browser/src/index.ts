/**
 * Browser MCP Server
 *
 * Playwright는 Bun과 호환되지 않으므로 Node.js로 @playwright/mcp CLI를 실행한다.
 * Bun 프로세스는 stdio를 패스스루하여 MCP 프로토콜을 중계만 한다.
 */
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

const home = process.env["HOME"] ?? "";

/** PATH와 잘 알려진 경로에서 실행 파일을 찾는다. */
function which(name: string): string {
	const dirs = [
		...(process.env["PATH"] ?? "").split(":"),
		join(home, ".local/share/mise/shims"),
		"/opt/homebrew/bin",
		"/usr/local/bin",
	];
	for (const dir of dirs) {
		const p = join(dir, name);
		if (existsSync(p)) return p;
	}
	throw new Error(`${name}를 찾을 수 없습니다`);
}

const node = which("node");
const cli = new URL("cli.js", import.meta.resolve("@playwright/mcp")).pathname;

execFileSync(node, [cli, "--viewport-size", "1440x900"], {
	stdio: "inherit",
});
