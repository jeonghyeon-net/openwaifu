import { mkdir } from "node:fs/promises";
import { AuthStorage, ModelRegistry, SettingsManager, getAgentDir, type AgentSession, type DefaultResourceLoader } from "@mariozechner/pi-coding-agent";
import { fixedPiProvider } from "../../config/pi-config.js";
import type { DiscordToolContext } from "../discord/tools/discord-admin-types.js";
import { createResourceLoader } from "./create-resource-loader.js";
import { ensureProviderAuth } from "./ensure-provider-auth.js";
import { emptyChatPromptOptions, type ChatPromptOptions, type PiRuntimeOptions } from "./pi-runtime-types.js";
import { createRuntimeStream } from "./pi-runtime-stream.js";
import { getOrCreateScopeSession, runScheduledPromptSession } from "./pi-runtime-session.js";
import type { ActivePrompt } from "./runtime-prompt.js";
export type { RuntimeTextChunk } from "./runtime-stream-state.js";
import { ScopedQueue } from "./scoped-queue.js";
import { clearScopeSessionStorage, readScopeSessionStats, sessionStatsFromManager, type ScopeSessionStats } from "./session-admin.js";
export class PiRuntime {
  private readonly agentDir = getAgentDir();
  private readonly authStorage = AuthStorage.create();
  private readonly modelRegistry = ModelRegistry.create(this.authStorage);
  private readonly settingsManager: SettingsManager;
  private readonly streamControl = new ScopedQueue();
  private readonly sessions = new Map<string, AgentSession>();
  private readonly sessionAccess = new Map<string, boolean>();
  private readonly sessionContext = new Map<string, string>();
  private readonly activePrompts = new Map<string, ActivePrompt>();
  private readonly model;
  private loader!: DefaultResourceLoader;
  private constructor(private readonly options: PiRuntimeOptions) {
    this.settingsManager = SettingsManager.create(this.options.repoRoot, this.agentDir);
    this.model = this.requireModel();
  }
  static async create(options: PiRuntimeOptions) {
    const runtime = new PiRuntime(options);
    await ensureProviderAuth(runtime.authStorage);
    await mkdir(runtime.options.sessionsRoot, { recursive: true });
    runtime.loader = await createResourceLoader({ repoRoot: runtime.options.repoRoot, agentDir: runtime.agentDir, settingsManager: runtime.settingsManager, extensionsRoot: runtime.options.extensionsRoot, skillsRoot: runtime.options.skillsRoot });
    await runtime.loader.reload();
    return runtime;
  }
  async prompt(scopeId: string, prompt: string, discordContext: DiscordToolContext, options: ChatPromptOptions = emptyChatPromptOptions) {
    let text = "";
    for await (const chunk of this.stream(scopeId, prompt, discordContext, options)) text += chunk.text;
    return text.trim() ? text : "응답 없음";
  }
  getScopeStats(scopeId: string): ScopeSessionStats | undefined {
    return this.sessions.get(scopeId)
      ? sessionStatsFromManager(this.sessions.get(scopeId)!.sessionManager)
      : readScopeSessionStats(this.options.repoRoot, this.options.sessionsRoot, scopeId);
  }

  async resetScope(scopeId: string) {
    const activePrompt = this.activePrompts.get(scopeId);
    if (activePrompt) {
      activePrompt.interrupted = true;
      await activePrompt.session.abort().catch(() => undefined);
      this.activePrompts.delete(scopeId);
    }
    const session = this.sessions.get(scopeId);
    if (session) {
      await session.abort().catch(() => undefined);
      session.dispose();
      this.sessions.delete(scopeId);
      this.sessionAccess.delete(scopeId);
      this.sessionContext.delete(scopeId);
    }
    return clearScopeSessionStorage(this.options.repoRoot, this.options.sessionsRoot, scopeId);
  }

  runScheduledPrompt(scopeId: string, taskId: string, prompt: string, discordContext: DiscordToolContext) {
    return runScheduledPromptSession(this.sessionDeps(), scopeId, taskId, prompt, discordContext);
  }

  stream(scopeId: string, prompt: string, discordContext: DiscordToolContext, options: ChatPromptOptions = emptyChatPromptOptions) {
    return createRuntimeStream({ repoRoot: this.options.repoRoot, scopeId, prompt, options, discordContext, activePrompts: this.activePrompts, streamControl: this.streamControl, getSession: this.getSession.bind(this) });
  }

  private requireModel() {
    const model = this.modelRegistry.find(fixedPiProvider, this.options.modelId);
    if (!model) throw new Error(`Model not found: ${fixedPiProvider}/${this.options.modelId}`);
    return model;
  }

  private getSession(scopeId: string, discordContext: DiscordToolContext) {
    return getOrCreateScopeSession({ ...this.sessionDeps(), sessions: this.sessions, sessionAccess: this.sessionAccess, sessionContext: this.sessionContext }, scopeId, discordContext);
  }

  private sessionDeps() {
    return {
      repoRoot: this.options.repoRoot,
      sessionsRoot: this.options.sessionsRoot,
      agentDir: this.agentDir,
      authStorage: this.authStorage,
      modelRegistry: this.modelRegistry,
      model: this.model,
      thinkingLevel: this.options.thinkingLevel,
      settingsManager: this.settingsManager,
      loader: this.loader,
      discordClient: this.options.discordClient,
    };
  }
}
