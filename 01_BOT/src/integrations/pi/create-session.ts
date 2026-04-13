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

import type { PiThinkingLevel } from "../../config/pi-config.js";
import { createDiscordAdminService } from "../discord/tools/discord-admin-service.js";
import type {
  DiscordAdminClient,
  DiscordToolContext,
} from "../discord/tools/discord-admin-types.js";
import { discordContextPrompt } from "../discord/tools/discord-context-prompt.js";
import { createDiscordManagementTools } from "../discord/tools/discord-management-tools.js";
import { registerDiscordSessionContext } from "./discord-session-context.js";
import { createRuntimeTools } from "./runtime-tools.js";

type CreatePiSessionOptions = {
  repoRoot: string;
  agentDir: string;
  authStorage: AuthStorage;
  modelRegistry: ModelRegistry;
  model: Model<any>;
  thinkingLevel?: PiThinkingLevel;
  settingsManager: SettingsManager;
  resourceLoader: ResourceLoader;
  sessionManager: SessionManager;
  scopeId: string;
  discordClient: DiscordAdminClient;
  discordContext: DiscordToolContext;
};

export const createPiSession = async (options: CreatePiSessionOptions): Promise<AgentSession> => {
  const { session } = await createAgentSession({
    cwd: options.repoRoot,
    agentDir: options.agentDir,
    authStorage: options.authStorage,
    modelRegistry: options.modelRegistry,
    model: options.model,
    thinkingLevel: options.thinkingLevel,
    settingsManager: options.settingsManager,
    resourceLoader: options.resourceLoader,
    sessionManager: options.sessionManager,
    tools: createRuntimeTools(options.repoRoot),
    customTools: createDiscordManagementTools(
      createDiscordAdminService(options.discordClient, options.discordContext),
    ),
  });

  const sessionFile = options.sessionManager.getSessionFile();
  if (sessionFile) {
    registerDiscordSessionContext(sessionFile, options.scopeId, options.discordContext);
  }

  session.agent.state.systemPrompt = [
    "You are concise Discord chat bot. Reply in user's language.",
    "Use discord_* tools when user asks to inspect or manage Discord server state.",
    "When user asks about current channel or server, answer from current_* context fields first.",
    discordContextPrompt(options.discordContext),
  ].join("\n");
  await session.bindExtensions({});
  return session;
};
