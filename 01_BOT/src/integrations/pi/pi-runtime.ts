import { mkdir } from "node:fs/promises";
import { AuthStorage, ModelRegistry, SessionManager, SettingsManager, getAgentDir, type AgentSession, type DefaultResourceLoader } from "@mariozechner/pi-coding-agent";

import { fixedPiProvider, type PiThinkingLevel } from "../../config/pi-config.js";
import type { ChatAttachment } from "../../features/chat/chat-attachment.js";
import type { DiscordAdminClient, DiscordToolContext } from "../discord/tools/discord-admin-types.js";
import { createPiSession } from "./create-session.js";
import { ensureProviderAuth } from "./ensure-provider-auth.js";
import { createResourceLoader } from "./create-resource-loader.js";
import { startRuntimePrompt, type ActivePrompt } from "./runtime-prompt.js";
export type { RuntimeTextChunk } from "./runtime-stream-state.js";
import { ScopedQueue } from "./scoped-queue.js";
import { sessionFileForScope } from "./session-path.js";

export type ChatPromptOptions = { messageId: string; attachments: ChatAttachment[] };
export type PiRuntimeOptions = {
  repoRoot: string;
  sessionsRoot: string;
  extensionsRoot: string;
  skillsRoot: string;
  modelId: string;
  thinkingLevel?: PiThinkingLevel;
  discordClient: DiscordAdminClient;
};

export class PiRuntime {
  private readonly agentDir = getAgentDir();
  private readonly authStorage = AuthStorage.create();
  private readonly modelRegistry = ModelRegistry.create(this.authStorage);
  private readonly settingsManager: SettingsManager;
  private readonly streamControl = new ScopedQueue();
  private readonly sessions = new Map<string, AgentSession>();
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

  async prompt(scopeId: string, prompt: string, discordContext: DiscordToolContext, options: ChatPromptOptions = { messageId: "", attachments: [] }) {
    let text = "";
    for await (const chunk of this.stream(scopeId, prompt, discordContext, options)) text += chunk.text;
    return text.trim() ? text : "응답 없음";
  }

  stream(scopeId: string, prompt: string, discordContext: DiscordToolContext, options: ChatPromptOptions = { messageId: "", attachments: [] }) {
    return { [Symbol.asyncIterator]: async function* (this: PiRuntime) {
      const started = await this.streamControl.run(scopeId, () => startRuntimePrompt({ repoRoot: this.options.repoRoot, scopeId, prompt, options, discordContext, activePrompts: this.activePrompts, getSession: this.getSession.bind(this) }));
      try {
        while (!started.state.isDone() || started.state.chunks.length > 0) {
          if (started.state.chunks.length === 0) await started.state.wait();
          else {
            const chunk = started.state.chunks.shift();
            if (chunk) yield chunk;
          }
        }
        const failure = started.getFailure();
        if (failure && !started.activePrompt.interrupted) throw failure;
      } finally {
        if (!started.state.isDone() && this.activePrompts.get(scopeId)?.token === started.activePrompt.token) {
          started.activePrompt.interrupted = true;
          await started.activePrompt.session.abort().catch(() => undefined);
        }
        await started.run;
      }
    }.bind(this) };
  }

  private requireModel() {
    const model = this.modelRegistry.find(fixedPiProvider, this.options.modelId);
    if (!model) throw new Error(`Model not found: ${fixedPiProvider}/${this.options.modelId}`);
    return model;
  }

  private async getSession(scopeId: string, discordContext: DiscordToolContext) {
    const cached = this.sessions.get(scopeId);
    if (cached) return cached;
    const sessionManager = SessionManager.open(sessionFileForScope(this.options.sessionsRoot, scopeId), this.options.sessionsRoot, this.options.repoRoot);
    const session = await createPiSession({ repoRoot: this.options.repoRoot, agentDir: this.agentDir, authStorage: this.authStorage, modelRegistry: this.modelRegistry, model: this.model, thinkingLevel: this.options.thinkingLevel, settingsManager: this.settingsManager, resourceLoader: this.loader, sessionManager, scopeId, discordClient: this.options.discordClient, discordContext });
    this.sessions.set(scopeId, session);
    return session;
  }
}
