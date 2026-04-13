import { AuthStorage, ModelRegistry, SessionManager, SettingsManager, getAgentDir, type AgentSession } from "@mariozechner/pi-coding-agent";

import { createResourceLoader } from "./create-resource-loader.js";
import { createPiSession } from "./create-session.js";
import { lastAssistantText } from "./last-assistant-text.js";
import { SerialQueue } from "./serial-queue.js";

export type PiRuntimeOptions = {
  repoRoot: string;
  extensionsRoot: string;
  skillsRoot: string;
  modelId: string;
};

export class PiRuntime {
  private readonly agentDir = getAgentDir();
  private readonly authStorage = AuthStorage.create();
  private readonly modelRegistry = ModelRegistry.create(this.authStorage);
  private readonly settingsManager: SettingsManager;
  private readonly sessionManager = SessionManager.inMemory();
  private readonly queue = new SerialQueue();
  private readonly model;
  private session!: AgentSession;

  private constructor(private readonly options: PiRuntimeOptions) {
    this.settingsManager = SettingsManager.create(this.options.repoRoot, this.agentDir);
    const model = this.modelRegistry.find("anthropic", this.options.modelId);
    if (!model) throw new Error(`Model not found: anthropic/${this.options.modelId}`);
    this.model = model;
  }

  static async create(options: PiRuntimeOptions) {
    const runtime = new PiRuntime(options);
    await runtime.refreshSession();
    return runtime;
  }

  prompt(prompt: string) {
    return this.queue.run(async () => {
      await this.session.prompt(prompt);
      return lastAssistantText(this.session);
    });
  }

  private async refreshSession() {
    const loader = await createResourceLoader({
      ...this.options,
      agentDir: this.agentDir,
      settingsManager: this.settingsManager,
    });
    await loader.reload();

    const session = await createPiSession({
      ...this.options,
      agentDir: this.agentDir,
      authStorage: this.authStorage,
      modelRegistry: this.modelRegistry,
      model: this.model,
      settingsManager: this.settingsManager,
      resourceLoader: loader,
      sessionManager: this.sessionManager,
    });

    this.session?.dispose();
    this.session = session;
  }
}
