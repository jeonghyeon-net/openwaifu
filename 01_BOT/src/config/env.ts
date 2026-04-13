import { join } from "node:path";

import { config as loadDotenv } from "dotenv";

import { resolvePiModel, resolvePiProvider, resolvePiReasoningEffort, resolvePiThinkingLevel } from "./pi-config.js";
import { paths } from "./paths.js";

loadDotenv({ path: join(paths.botRoot, ".env") });

const discordBotToken = process.env.DISCORD_BOT_TOKEN;
if (!discordBotToken) throw new Error("Missing DISCORD_BOT_TOKEN");
const piProvider = resolvePiProvider(process.env);

export const env = {
  discordBotToken,
  piProvider,
  piModel: resolvePiModel(process.env, piProvider),
  piThinkingLevel: resolvePiThinkingLevel(process.env),
  piReasoningEffort: resolvePiReasoningEffort(process.env),
};
