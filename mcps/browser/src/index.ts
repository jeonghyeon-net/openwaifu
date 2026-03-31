import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createConnection } from "@playwright/mcp";

const server = await createConnection({
	browser: {
		browserName: "chromium",
		launchOptions: { headless: true },
	},
});

await server.connect(new StdioServerTransport());
