import { SessionManager, type AgentSession, type AuthStorage, type ModelRegistry, type ResourceLoader, type SettingsManager } from "@mariozechner/pi-coding-agent";
import type { Model } from "@mariozechner/pi-ai";

import type { PiThinkingLevel } from "../../config/pi-config.js";
import { canUseDiscordManagementTools } from "../discord/tools/discord-admin-access.js";
import type { DiscordAdminClient, DiscordToolContext } from "../discord/tools/discord-admin-types.js";
import { createPiSession } from "./create-session.js";
import { clearScheduledSessionStorage } from "./session-admin.js";
import { sessionFileForScope, sessionFileForScheduledRun } from "./session-path.js";

type SessionDeps = {
  repoRoot: string;
  sessionsRoot: string;
  agentDir: string;
  authStorage: AuthStorage;
  modelRegistry: ModelRegistry;
  model: Model<any>;
  thinkingLevel?: PiThinkingLevel;
  settingsManager: SettingsManager;
  loader: ResourceLoader;
  discordClient: DiscordAdminClient;
};

const contextCacheKey = (context: DiscordToolContext) => JSON.stringify(context);

const createRuntimeSession = async (deps: SessionDeps, sessionManager: SessionManager, scopeId: string, discordContext: DiscordToolContext) =>
  createPiSession({
    repoRoot: deps.repoRoot,
    agentDir: deps.agentDir,
    authStorage: deps.authStorage,
    modelRegistry: deps.modelRegistry,
    model: deps.model,
    thinkingLevel: deps.thinkingLevel,
    settingsManager: deps.settingsManager,
    resourceLoader: deps.loader,
    sessionManager,
    scopeId,
    discordClient: deps.discordClient,
    discordContext,
  });

export const getOrCreateScopeSession = async (
  deps: SessionDeps & { sessions: Map<string, AgentSession>; sessionAccess: Map<string, boolean>; sessionContext: Map<string, string> },
  scopeId: string,
  discordContext: DiscordToolContext,
) => {
  const nextAccess = await canUseDiscordManagementTools(deps.discordClient, discordContext);
  const nextContext = contextCacheKey(discordContext);
  const cached = deps.sessions.get(scopeId);
  if (cached && deps.sessionAccess.get(scopeId) === nextAccess && deps.sessionContext.get(scopeId) === nextContext) return cached;
  if (cached) {
    await cached.abort().catch(() => undefined);
    cached.dispose();
    deps.sessions.delete(scopeId);
  }
  const sessionManager = SessionManager.open(sessionFileForScope(deps.sessionsRoot, scopeId), deps.sessionsRoot, deps.repoRoot);
  const session = await createRuntimeSession(deps, sessionManager, scopeId, discordContext);
  deps.sessions.set(scopeId, session);
  deps.sessionAccess.set(scopeId, nextAccess);
  deps.sessionContext.set(scopeId, nextContext);
  return session;
};

export const runScheduledPromptSession = async (deps: SessionDeps, scopeId: string, taskId: string, prompt: string, discordContext: DiscordToolContext) => {
  const sessionFile = sessionFileForScheduledRun(deps.sessionsRoot, scopeId, taskId);
  const sessionManager = SessionManager.open(sessionFile, deps.sessionsRoot, deps.repoRoot);
  const session = await createRuntimeSession(deps, sessionManager, scopeId, discordContext);
  try {
    await session.prompt(prompt);
  } finally {
    session.dispose();
    await clearScheduledSessionStorage(sessionFile);
  }
};
