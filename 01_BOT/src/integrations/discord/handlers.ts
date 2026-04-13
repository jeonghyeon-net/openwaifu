import { Events, type Client, type Message } from "discord.js";

import type { ChatService } from "../../features/chat/chat-service.js";
import type { PiAdminService } from "../../features/pi-admin/pi-admin-service.js";

const limitText = (text: string) => (text.length > 1900 ? `${text.slice(0, 1885)}\n\n(truncated)` : text);

type HandlerDeps = {
  client: Client;
  chatService: ChatService;
  piAdminService: PiAdminService;
};

const getPrompt = (message: Message<boolean>, client: Client): string | null => {
  if (!client.user || message.author.bot) return null;

  if (message.channel.isDMBased()) {
    return message.content.trim() || "안녕";
  }

  if (!message.mentions.has(client.user.id)) {
    return null;
  }

  return message.content.replace(new RegExp(`<@!?${client.user.id}>`, "g"), "").trim() || "안녕";
};

export const registerDiscordHandlers = ({ client, chatService, piAdminService }: HandlerDeps) => {
  client.on(Events.MessageCreate, async (message) => {
    const prompt = getPrompt(message, client);
    if (!prompt) return;

    if (prompt.startsWith("/pi")) {
      await message.reply("Use slash command `/pi`.");
      return;
    }

    const reply = await message.reply("생각 중...");

    try {
      await reply.edit(limitText(await chatService.run(prompt)));
    } catch (error) {
      const text = error instanceof Error ? error.message : String(error);
      await reply.edit(limitText(`에러: ${text}`));
    }
  });

  client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    try {
      if (interaction.commandName === "chat") {
        await interaction.deferReply();
        const prompt = interaction.options.getString("prompt", true);
        await interaction.editReply(limitText(await chatService.run(prompt)));
        return;
      }

      if (interaction.commandName === "pi") {
        await interaction.deferReply();
        const action = interaction.options.getSubcommand();
        const text =
          action === "packages"
            ? await piAdminService.packages()
            : action === "resources"
              ? await piAdminService.resources()
              : action === "install"
                ? await piAdminService.install(interaction.options.getString("source", true))
                : action === "remove"
                  ? await piAdminService.remove(interaction.options.getString("source", true))
                  : await piAdminService.reload();

        await interaction.editReply(limitText(text));
      }
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
