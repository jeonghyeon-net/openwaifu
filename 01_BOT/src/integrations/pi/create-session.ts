import { type Client } from "discord.js";

import {
  createAgentSession,
  type AgentSession,
  type AuthStorage,
  type ModelRegistry,
  type ResourceLoader,
  type SessionManager,
  type SettingsManager,
} from "@mariozechner/pi-coding-agent";
import type { Model } from "@mariozechner/pi-ai";

import type { DiscordAdminAccess } from "../discord/tools/discord-admin-access.js";
import { createDiscordAdminService } from "../discord/tools/discord-admin-service.js";
import type { DiscordToolContext } from "../discord/tools/discord-admin-types.js";
import { discordContextPrompt } from "../discord/tools/discord-context-prompt.js";
import { createDiscordManagementTools } from "../discord/tools/discord-management-tools.js";
import { createRuntimeTools } from "./runtime-tools.js";

type CreatePiSessionOptions = {
  repoRoot: string;
  agentDir: string;
  authStorage: AuthStorage;
  modelRegistry: ModelRegistry;
  model: Model<any>;
  settingsManager: SettingsManager;
  resourceLoader: ResourceLoader;
  sessionManager: SessionManager;
  discordClient: Client;
  discordContext: DiscordToolContext;
  discordAdminAccess: DiscordAdminAccess;
};

export const createPiSession = async (options: CreatePiSessionOptions): Promise<AgentSession> => {
  const customTools = options.discordAdminAccess.enabled
    ? createDiscordManagementTools(
        createDiscordAdminService(options.discordClient, options.discordContext, options.discordAdminAccess),
      )
    : [];
  const { session } = await createAgentSession({
    cwd: options.repoRoot,
    agentDir: options.agentDir,
    authStorage: options.authStorage,
    modelRegistry: options.modelRegistry,
    model: options.model,
    settingsManager: options.settingsManager,
    resourceLoader: options.resourceLoader,
    sessionManager: options.sessionManager,
    tools: createRuntimeTools(options.repoRoot),
    customTools,
  });

  session.agent.state.systemPrompt = [
    "You are concise Discord chat bot. Reply in user's language.",
    ...(options.discordAdminAccess.enabled ? ["Use discord_* tools for authorized Discord server management."] : []),
    discordContextPrompt(options.discordContext),
  ].join("\n");
  await session.bindExtensions({});
  return session;
};
