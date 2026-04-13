import { join } from "node:path";

import { config as loadDotenv } from "dotenv";

import { paths } from "./paths.js";

loadDotenv({ path: join(paths.botRoot, ".env") });

const discordBotToken = process.env.DISCORD_BOT_TOKEN;
if (!discordBotToken) throw new Error("Missing DISCORD_BOT_TOKEN");

const discordAdminUserIds = (process.env.DISCORD_ADMIN_USER_IDS ?? "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

export const env = {
  discordBotToken,
  discordAdminUserIds,
  piModel: process.env.PI_MODEL ?? "claude-sonnet-4-5",
};
