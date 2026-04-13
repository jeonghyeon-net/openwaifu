import { join } from "node:path";

import { config as loadDotenv } from "dotenv";

import { resolvePiModel, resolvePiThinkingLevel } from "./pi-config.js";
import { paths } from "./paths.js";

loadDotenv({ path: join(paths.botRoot, ".env") });

const discordBotToken = process.env.DISCORD_BOT_TOKEN;
if (!discordBotToken) throw new Error("Missing DISCORD_BOT_TOKEN");

export const env = {
  discordBotToken,
  piModel: resolvePiModel(process.env),
  piThinkingLevel: resolvePiThinkingLevel(process.env),
};
