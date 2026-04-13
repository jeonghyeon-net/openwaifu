import { mkdir } from "node:fs/promises";

import {
  AuthStorage,
  ModelRegistry,
  SessionManager,
  SettingsManager,
  getAgentDir,
  type AgentSession,
  type DefaultResourceLoader,
} from "@mariozechner/pi-coding-agent";

import type { PiReasoningEffort, PiThinkingLevel } from "../../config/pi-config.js";
import type { DiscordAdminClient, DiscordToolContext } from "../discord/tools/discord-admin-types.js";
import { createPiSession } from "./create-session.js";
import { ensureProviderAuth } from "./ensure-provider-auth.js";
import { createResourceLoader } from "./create-resource-loader.js";
import { lastAssistantText } from "./last-assistant-text.js";
import { ScopedQueue } from "./scoped-queue.js";
import { sessionFileForScope } from "./session-path.js";

export type PiRuntimeOptions = {
  repoRoot: string;
  sessionsRoot: string;
  extensionsRoot: string;
  skillsRoot: string;
  provider: string;
  modelId: string;
  thinkingLevel?: PiThinkingLevel;
  reasoningEffort?: PiReasoningEffort;
  discordClient: DiscordAdminClient;
};

export class PiRuntime {
  private readonly agentDir = getAgentDir();
  private readonly authStorage = AuthStorage.create();
  private readonly modelRegistry = ModelRegistry.create(this.authStorage);
  private readonly settingsManager: SettingsManager;
  private readonly queue = new ScopedQueue();
  private readonly sessions = new Map<string, AgentSession>();
  private readonly model;
  private loader!: DefaultResourceLoader;

  private constructor(private readonly options: PiRuntimeOptions) {
    this.settingsManager = SettingsManager.create(this.options.repoRoot, this.agentDir);
    const model = this.modelRegistry.find(this.options.provider, this.options.modelId);
    if (!model) throw new Error(`Model not found: ${this.options.provider}/${this.options.modelId}`);
    this.model = model;
  }

  static async create(options: PiRuntimeOptions) {
    const runtime = new PiRuntime(options);
    await ensureProviderAuth(runtime.authStorage, runtime.options.provider);
    await mkdir(runtime.options.sessionsRoot, { recursive: true });
    runtime.loader = await createResourceLoader({
      repoRoot: runtime.options.repoRoot,
      agentDir: runtime.agentDir,
      settingsManager: runtime.settingsManager,
      extensionsRoot: runtime.options.extensionsRoot,
      skillsRoot: runtime.options.skillsRoot,
    });
    await runtime.loader.reload();
    return runtime;
  }

  prompt(scopeId: string, prompt: string, discordContext: DiscordToolContext) {
    return this.queue.run(scopeId, async () => {
      const session = await this.getSession(scopeId, discordContext);
      await session.prompt(prompt);
      return lastAssistantText(session);
    });
  }

  private async getSession(scopeId: string, discordContext: DiscordToolContext) {
    const cached = this.sessions.get(scopeId);
    if (cached) return cached;
    const session = await createPiSession({
      repoRoot: this.options.repoRoot,
      agentDir: this.agentDir,
      authStorage: this.authStorage,
      modelRegistry: this.modelRegistry,
      model: this.model,
      thinkingLevel: this.options.thinkingLevel,
      reasoningEffort: this.options.reasoningEffort,
      settingsManager: this.settingsManager,
      resourceLoader: this.loader,
      sessionManager: SessionManager.open(
        sessionFileForScope(this.options.sessionsRoot, scopeId),
        this.options.sessionsRoot,
        this.options.repoRoot,
      ),
      discordClient: this.options.discordClient,
      discordContext,
    });

    this.sessions.set(scopeId, session);
    return session;
  }
}
