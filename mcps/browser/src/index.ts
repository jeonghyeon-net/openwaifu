import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
	CallToolRequestSchema,
	ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

/** 도구 이름 변경 맵: 원래 이름 → { 새 이름, 새 설명 } */
const RENAMES: Record<string, { name: string; description: string }> = {
	browser_take_screenshot: {
		name: "browser_capture_and_send_screenshot",
		description: "현재 브라우저 페이지의 스크린샷을 찍어 유저에게 전송합니다",
	},
};

const REVERSE_NAMES = new Map(
	Object.entries(RENAMES).map(([orig, { name }]) => [name, orig]),
);

// @playwright/mcp CLI 경로 해석
const cliPath = new URL("cli.js", import.meta.resolve("@playwright/mcp"))
	.pathname;

// @playwright/mcp를 서브프로세스로 실행, 클라이언트로 연결
const client = new Client(
	{ name: "browser-proxy", version: "0.1.0" },
	{ capabilities: {} },
);
await client.connect(
	new StdioClientTransport({
		command: "bun",
		args: ["run", cliPath, "--headless"],
	}),
);

// 프록시 서버 생성
const server = new Server(
	{ name: "browser", version: "0.1.0" },
	{ capabilities: { tools: {} } },
);

// tools/list: 도구 목록에서 이름 변경
server.setRequestHandler(ListToolsRequestSchema, async () => {
	const { tools } = await client.listTools();
	return {
		tools: tools.map((t) => {
			const r = RENAMES[t.name];
			return r ? { ...t, name: r.name, description: r.description } : t;
		}),
	};
});

// tools/call: 변경된 이름을 원래 이름으로 복원 후 전달
server.setRequestHandler(CallToolRequestSchema, async (req) => {
	const originalName = REVERSE_NAMES.get(req.params.name) ?? req.params.name;
	return await client.callTool({
		name: originalName,
		arguments: req.params.arguments,
	});
});

await server.connect(new StdioServerTransport());
