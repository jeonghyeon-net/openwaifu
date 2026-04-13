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

import { createResourceLoader } from "./create-resource-loader.js";
import { createPiSession } from "./create-session.js";
import { lastAssistantText } from "./last-assistant-text.js";
import { SerialQueue } from "./serial-queue.js";
import { sessionFileForScope } from "./session-path.js";

export type PiRuntimeOptions = {
  repoRoot: string;
  sessionsRoot: string;
  extensionsRoot: string;
  skillsRoot: string;
  modelId: string;
};

export class PiRuntime {
  private readonly agentDir = getAgentDir();
  private readonly authStorage = AuthStorage.create();
  private readonly modelRegistry = ModelRegistry.create(this.authStorage);
  private readonly settingsManager: SettingsManager;
  private readonly queue = new SerialQueue();
  private readonly sessions = new Map<string, AgentSession>();
  private readonly model;
  private loader!: DefaultResourceLoader;

  private constructor(private readonly options: PiRuntimeOptions) {
    this.settingsManager = SettingsManager.create(this.options.repoRoot, this.agentDir);
    const model = this.modelRegistry.find("anthropic", this.options.modelId);
    if (!model) throw new Error(`Model not found: anthropic/${this.options.modelId}`);
    this.model = model;
  }

  static async create(options: PiRuntimeOptions) {
    const runtime = new PiRuntime(options);
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

  prompt(scopeId: string, prompt: string) {
    return this.queue.run(async () => {
      const session = await this.getSession(scopeId);
      await session.prompt(prompt);
      return lastAssistantText(session);
    });
  }

  private async getSession(scopeId: string) {
    const cached = this.sessions.get(scopeId);
    if (cached) return cached;

    const session = await createPiSession({
      repoRoot: this.options.repoRoot,
      agentDir: this.agentDir,
      authStorage: this.authStorage,
      modelRegistry: this.modelRegistry,
      model: this.model,
      settingsManager: this.settingsManager,
      resourceLoader: this.loader,
      sessionManager: SessionManager.open(
        sessionFileForScope(this.options.sessionsRoot, scopeId),
        this.options.sessionsRoot,
        this.options.repoRoot,
      ),
    });

    this.sessions.set(scopeId, session);
    return session;
  }
}
