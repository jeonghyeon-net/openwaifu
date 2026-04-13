import { join } from "node:path";

import { config as loadDotenv } from "dotenv";

import { paths } from "./paths.js";

loadDotenv({ path: join(paths.botRoot, ".env") });

const discordBotToken = process.env.DISCORD_BOT_TOKEN;
if (!discordBotToken) throw new Error("Missing DISCORD_BOT_TOKEN");

export const env = {
  discordBotToken,
  discordGuildId: process.env.DISCORD_GUILD_ID,
  piModel: process.env.PI_MODEL ?? "claude-sonnet-4-5",
};
