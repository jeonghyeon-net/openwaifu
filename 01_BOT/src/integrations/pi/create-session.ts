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
};

export const createPiSession = async (options: CreatePiSessionOptions): Promise<AgentSession> => {
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
  });

  session.agent.state.systemPrompt = "You are concise Discord chat bot. Reply in user's language.";
  await session.bindExtensions({});
  return session;
};
