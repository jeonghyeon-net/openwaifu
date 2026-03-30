import { createSdkMcpServer, tool } from "@anthropic-ai/claude-agent-sdk";
import type { Bot } from "grammy";
import { z } from "zod";

function ok(text: string) {
	return { content: [{ type: "text" as const, text }] };
}

export function createTelegramMcpServer(bot: Bot) {
	const sendMessage = tool(
		"telegram_send_message",
		"Send a message to a Telegram chat",
		{
			chatId: z.string(),
			text: z.string(),
			parseMode: z.enum(["HTML", "Markdown", "MarkdownV2"]).optional(),
		},
		async ({ chatId, text, parseMode }) => {
			const msg = await bot.api.sendMessage(
				Number(chatId),
				text,
				parseMode ? { parse_mode: parseMode } : {},
			);
			return ok(`Sent message ${msg.message_id}`);
		},
	);

	const editMessage = tool(
		"telegram_edit_message",
		"Edit a message in a Telegram chat",
		{ chatId: z.string(), messageId: z.number(), text: z.string() },
		async ({ chatId, messageId, text }) => {
			await bot.api.editMessageText(Number(chatId), messageId, text);
			return ok(`Edited message ${messageId}`);
		},
	);

	const deleteMessage = tool(
		"telegram_delete_message",
		"Delete a message from a Telegram chat",
		{ chatId: z.string(), messageId: z.number() },
		async ({ chatId, messageId }) => {
			await bot.api.deleteMessage(Number(chatId), messageId);
			return ok(`Deleted message ${messageId}`);
		},
	);

	const forwardMessage = tool(
		"telegram_forward_message",
		"Forward a message to another chat",
		{
			fromChatId: z.string(),
			toChatId: z.string(),
			messageId: z.number(),
		},
		async ({ fromChatId, toChatId, messageId }) => {
			const msg = await bot.api.forwardMessage(
				Number(toChatId),
				Number(fromChatId),
				messageId,
			);
			return ok(`Forwarded message ${msg.message_id}`);
		},
	);

	const sendPhoto = tool(
		"telegram_send_photo",
		"Send a photo to a Telegram chat",
		{
			chatId: z.string(),
			photoUrl: z.string(),
			caption: z.string().optional(),
		},
		async ({ chatId, photoUrl, caption }) => {
			const msg = await bot.api.sendPhoto(
				Number(chatId),
				photoUrl,
				caption ? { caption } : {},
			);
			return ok(`Sent photo ${msg.message_id}`);
		},
	);

	const getChat = tool(
		"telegram_get_chat",
		"Get information about a chat",
		{ chatId: z.string() },
		async ({ chatId }) => {
			const chat = await bot.api.getChat(Number(chatId));
			return ok(JSON.stringify(chat));
		},
	);

	const getChatMemberCount = tool(
		"telegram_get_chat_member_count",
		"Get the number of members in a chat",
		{ chatId: z.string() },
		async ({ chatId }) => {
			const count = await bot.api.getChatMemberCount(Number(chatId));
			return ok(`${count} members`);
		},
	);

	const getChatMember = tool(
		"telegram_get_chat_member",
		"Get info about a member of a chat",
		{ chatId: z.string(), userId: z.number() },
		async ({ chatId, userId }) => {
			const member = await bot.api.getChatMember(Number(chatId), userId);
			return ok(JSON.stringify(member));
		},
	);

	const pinMessage = tool(
		"telegram_pin_message",
		"Pin a message in a chat",
		{ chatId: z.string(), messageId: z.number() },
		async ({ chatId, messageId }) => {
			await bot.api.pinChatMessage(Number(chatId), messageId);
			return ok(`Pinned message ${messageId}`);
		},
	);

	const unpinMessage = tool(
		"telegram_unpin_message",
		"Unpin a message in a chat",
		{ chatId: z.string(), messageId: z.number() },
		async ({ chatId, messageId }) => {
			await bot.api.unpinChatMessage(Number(chatId), messageId);
			return ok(`Unpinned message ${messageId}`);
		},
	);

	const setChatTitle = tool(
		"telegram_set_chat_title",
		"Set the title of a group or channel",
		{ chatId: z.string(), title: z.string() },
		async ({ chatId, title }) => {
			await bot.api.setChatTitle(Number(chatId), title);
			return ok(`Set title to ${title}`);
		},
	);

	const setChatDescription = tool(
		"telegram_set_chat_description",
		"Set the description of a group or channel",
		{ chatId: z.string(), description: z.string() },
		async ({ chatId, description }) => {
			await bot.api.setChatDescription(Number(chatId), description);
			return ok(`Set description`);
		},
	);

	const getMe = tool(
		"telegram_get_me",
		"Get information about the bot itself",
		{},
		async () => {
			const me = await bot.api.getMe();
			return ok(JSON.stringify(me));
		},
	);

	return createSdkMcpServer({
		name: "telegram",
		tools: [
			sendMessage,
			editMessage,
			deleteMessage,
			forwardMessage,
			sendPhoto,
			getChat,
			getChatMemberCount,
			getChatMember,
			pinMessage,
			unpinMessage,
			setChatTitle,
			setChatDescription,
			getMe,
		],
	});
}
