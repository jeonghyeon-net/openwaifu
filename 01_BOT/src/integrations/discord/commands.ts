import { SlashCommandBuilder } from "discord.js";

export const slashCommands = [
  new SlashCommandBuilder()
    .setName("chat")
    .setDescription("Talk to bot")
    .addStringOption((option) => option.setName("prompt").setDescription("Message for bot").setRequired(true)),
  new SlashCommandBuilder()
    .setName("pi")
    .setDescription("Manage pi packages and resources")
    .addSubcommand((subcommand) => subcommand.setName("packages").setDescription("List configured pi packages"))
    .addSubcommand((subcommand) => subcommand.setName("resources").setDescription("List loaded extensions, skills, prompts, themes"))
    .addSubcommand((subcommand) =>
      subcommand
        .setName("install")
        .setDescription("Install pi package")
        .addStringOption((option) => option.setName("source").setDescription("Package source").setRequired(true)),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("remove")
        .setDescription("Remove pi package")
        .addStringOption((option) => option.setName("source").setDescription("Package source").setRequired(true)),
    )
    .addSubcommand((subcommand) => subcommand.setName("reload").setDescription("Reload pi resources")),
].map((command) => command.toJSON());
