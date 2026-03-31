// Playwright는 Bun에서 동작하지 않으므로 npx로 직접 실행
import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

function findNpx(): string {
	// 1. PATH에서 찾기
	try {
		return execSync("which npx", { encoding: "utf-8" }).trim();
	} catch {
		// which 실패 시 일반적인 경로 확인
	}

	const home = process.env["HOME"] ?? "";
	const candidates = [
		join(home, ".local/share/mise/shims/npx"),
		"/opt/homebrew/bin/npx",
		"/usr/local/bin/npx",
	];
	for (const p of candidates) {
		if (existsSync(p)) return p;
	}

	throw new Error(
		"npx를 찾을 수 없습니다. Node.js를 설치하세요 (mise install node)",
	);
}

// stdin/stdout을 그대로 패스스루 — MCP stdio 프로토콜 유지
execSync(`${findNpx()} -y @playwright/mcp`, { stdio: "inherit" });
