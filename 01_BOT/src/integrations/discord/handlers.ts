import { Events, type Client, type Message } from "discord.js";

import type { ChatService } from "../../features/chat/chat-service.js";

const limitText = (text: string) =>
  text.length > 1900 ? `${text.slice(0, 1885)}\n\n(truncated)` : text;

type HandlerDeps = {
  client: Client;
  chatService: ChatService;
};

const getPrompt = (message: Message<boolean>, client: Client): string | null => {
  if (!client.user || message.author.bot) return null;
  if (message.channel.isDMBased()) return message.content.trim() || "안녕";
  if (!message.mentions.has(client.user.id)) return null;
  return message.content.replace(new RegExp(`<@!?${client.user.id}>`, "g"), "").trim() || "안녕";
};

export const registerDiscordHandlers = ({ client, chatService }: HandlerDeps) => {
  client.on(Events.MessageCreate, async (message) => {
    const prompt = getPrompt(message, client);
    if (!prompt) return;

    const reply = await message.reply("생각 중...");

    try {
      await reply.edit(limitText(await chatService.run(prompt)));
    } catch (error) {
      const text = error instanceof Error ? error.message : String(error);
      await reply.edit(limitText(`에러: ${text}`));
    }
  });

  client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isChatInputCommand() || interaction.commandName !== "chat") return;

    try {
      await interaction.deferReply();
      const prompt = interaction.options.getString("prompt", true);
      await interaction.editReply(limitText(await chatService.run(prompt)));
    } catch (error) {
      const text = limitText(error instanceof Error ? error.message : String(error));
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply(`에러: ${text}`);
      } else {
        await interaction.reply(`에러: ${text}`);
      }
    }
  });
};
