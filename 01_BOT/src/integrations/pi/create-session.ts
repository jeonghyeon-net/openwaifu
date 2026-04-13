import {
  createAgentSession,
  type AgentSession,
  type AuthStorage,
  type ModelRegistry,
  type SessionManager,
  type SettingsManager,
  type ResourceLoader,
} from "@mariozechner/pi-coding-agent";
import type { Model } from "@mariozechner/pi-ai";

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
    tools: [],
  });

  session.agent.state.systemPrompt = [
    "You are concise Discord chat bot.",
    "Reply in user's language.",
    "Pi package management happens through Discord slash command /pi.",
  ].join("\n");
  await session.bindExtensions({});
  return session;
};
