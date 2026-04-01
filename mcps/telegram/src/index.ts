import { existsSync, readFileSync } from "node:fs";
import { env } from "@lib/env";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { Bot, InputFile } from "grammy";
import { z } from "zod";

const server = new McpServer({ name: "telegram", version: "0.0.1" });
const token = env("TELEGRAM_TOKEN");
const bot = new Bot(token);

server.registerTool(
	"send_message",
	{
		description: "Send a message to a Telegram chat",
		inputSchema: { chatId: z.string(), text: z.string() },
	},
	async ({ chatId, text }) => {
		try {
			const msg = await bot.api.sendMessage(Number(chatId), text);
			return {
				content: [{ type: "text", text: `Sent message ${msg.message_id}` }],
			};
		} catch (e: unknown) {
			const message = e instanceof Error ? e.message : String(e);
			return { content: [{ type: "text", text: message }], isError: true };
		}
	},
);

server.registerTool(
	"edit_message",
	{
		description: "Edit a message in a Telegram chat",
		inputSchema: {
			chatId: z.string(),
			messageId: z.number(),
			text: z.string(),
		},
	},
	async ({ chatId, messageId, text }) => {
		try {
			await bot.api.editMessageText(Number(chatId), messageId, text);
			return {
				content: [{ type: "text", text: `Edited message ${messageId}` }],
			};
		} catch (e: unknown) {
			const message = e instanceof Error ? e.message : String(e);
			return { content: [{ type: "text", text: message }], isError: true };
		}
	},
);

server.registerTool(
	"delete_message",
	{
		description: "Delete a message from a Telegram chat",
		inputSchema: { chatId: z.string(), messageId: z.number() },
	},
	async ({ chatId, messageId }) => {
		try {
			await bot.api.deleteMessage(Number(chatId), messageId);
			return {
				content: [{ type: "text", text: `Deleted message ${messageId}` }],
			};
		} catch (e: unknown) {
			const message = e instanceof Error ? e.message : String(e);
			return { content: [{ type: "text", text: message }], isError: true };
		}
	},
);

server.registerTool(
	"send_photo",
	{
		description: "Send a photo to a Telegram chat",
		inputSchema: {
			chatId: z.string(),
			url: z.string(),
			caption: z.string().optional(),
		},
	},
	async ({ chatId, url, caption }) => {
		try {
			const source = existsSync(url)
				? new InputFile(readFileSync(url), url.split("/").pop())
				: url;
			const msg = await bot.api.sendPhoto(
				Number(chatId),
				source,
				caption ? { caption } : {},
			);
			return {
				content: [{ type: "text", text: `Sent photo ${msg.message_id}` }],
			};
		} catch (e: unknown) {
			const message = e instanceof Error ? e.message : String(e);
			return { content: [{ type: "text", text: message }], isError: true };
		}
	},
);

server.registerTool(
	"get_chat",
	{
		description: "Get information about a Telegram chat",
		inputSchema: { chatId: z.string() },
	},
	async ({ chatId }) => {
		try {
			const chat = await bot.api.getChat(Number(chatId));
			return { content: [{ type: "text", text: JSON.stringify(chat) }] };
		} catch (e: unknown) {
			const message = e instanceof Error ? e.message : String(e);
			return { content: [{ type: "text", text: message }], isError: true };
		}
	},
);

server.registerTool(
	"get_chat_members_count",
	{
		description: "Get the number of members in a chat",
		inputSchema: { chatId: z.string() },
	},
	async ({ chatId }) => {
		try {
			const count = await bot.api.getChatMemberCount(Number(chatId));
			return { content: [{ type: "text", text: String(count) }] };
		} catch (e: unknown) {
			const message = e instanceof Error ? e.message : String(e);
			return { content: [{ type: "text", text: message }], isError: true };
		}
	},
);

server.registerTool(
	"pin_message",
	{
		description: "Pin a message in a Telegram chat",
		inputSchema: { chatId: z.string(), messageId: z.number() },
	},
	async ({ chatId, messageId }) => {
		try {
			await bot.api.pinChatMessage(Number(chatId), messageId);
			return {
				content: [{ type: "text", text: `Pinned message ${messageId}` }],
			};
		} catch (e: unknown) {
			const message = e instanceof Error ? e.message : String(e);
			return { content: [{ type: "text", text: message }], isError: true };
		}
	},
);

server.registerTool(
	"unpin_message",
	{
		description: "Unpin a message in a Telegram chat",
		inputSchema: { chatId: z.string(), messageId: z.number() },
	},
	async ({ chatId, messageId }) => {
		try {
			await bot.api.unpinChatMessage(Number(chatId), messageId);
			return {
				content: [{ type: "text", text: `Unpinned message ${messageId}` }],
			};
		} catch (e: unknown) {
			const message = e instanceof Error ? e.message : String(e);
			return { content: [{ type: "text", text: message }], isError: true };
		}
	},
);

await server.connect(new StdioServerTransport());
