import { SlashCommandBuilder } from "discord.js";

export const slashCommands = [
  new SlashCommandBuilder()
    .setName("chat")
    .setDescription("Talk to bot")
    .addStringOption((option) => option.setName("prompt").setDescription("Message for bot").setRequired(true)),
].map((command) => command.toJSON());
