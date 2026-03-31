// Playwright는 Bun에서 동작하지 않으므로 npx로 직접 실행
import { execSync } from "node:child_process";

const npxPath = process.env["PATH"]?.includes("/opt/homebrew/bin")
	? "npx"
	: "/opt/homebrew/bin/npx";

// stdin/stdout을 그대로 패스스루 — MCP stdio 프로토콜 유지
execSync(`${npxPath} @playwright/mcp`, { stdio: "inherit" });
