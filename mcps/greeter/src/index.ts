import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

const server = new McpServer({
	name: "greeter",
	version: "0.0.1",
});

server.tool(
	"greet",
	"Greet someone by name",
	{ name: z.string() },
	async ({ name }) => ({
		content: [{ type: "text" as const, text: `Hello, ${name}!` }],
	}),
);

async function main() {
	const transport = await import("@modelcontextprotocol/sdk/server/stdio.js");
	await server.connect(new transport.StdioServerTransport());
}

main();
