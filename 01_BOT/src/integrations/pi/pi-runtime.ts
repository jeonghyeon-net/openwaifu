import { AuthStorage, DefaultPackageManager, getAgentDir, ModelRegistry, SessionManager, SettingsManager, type AgentSession, type DefaultResourceLoader } from "@mariozechner/pi-coding-agent";

import { createResourceLoader } from "./create-resource-loader.js";
import { createPiSession } from "./create-session.js";
import { lastAssistantText } from "./last-assistant-text.js";
import { limitText } from "./format-text.js";
import { formatResourceReport } from "./resource-report.js";
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
  private readonly packageManager: DefaultPackageManager;
  private readonly sessionManager = SessionManager.inMemory();
  private readonly queue = new SerialQueue();
  private readonly model;
  private resourceLoader?: DefaultResourceLoader;
  private session?: AgentSession;

  private constructor(private readonly options: PiRuntimeOptions) {
    this.settingsManager = SettingsManager.create(this.options.repoRoot, this.agentDir);
    this.packageManager = new DefaultPackageManager({
      cwd: this.options.repoRoot,
      agentDir: this.agentDir,
      settingsManager: this.settingsManager,
    });
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
      const session = await this.requireSession();
      await session.prompt(prompt);
      return lastAssistantText(session);
    });
  }

  listPackages() {
    return this.queue.run(async () => {
      const packages = this.packageManager.listConfiguredPackages();
      const text = packages.length
        ? packages.map((pkg) => `[${pkg.scope}] ${pkg.source}${pkg.installedPath ? `\n  ${pkg.installedPath}` : ""}`).join("\n")
        : "No configured pi packages.";
      return limitText(text);
    });
  }

  listResources() { return this.queue.run(async () => formatResourceReport(await this.requireLoader())); }
  installPackage(source: string) { return this.changePackage(source, () => this.packageManager.installAndPersist(source, { local: true }), "Installed"); }
  removePackage(source: string) { return this.changePackage(source, () => this.packageManager.removeAndPersist(source, { local: true }), "Removed", "Not found"); }
  reloadResources() { return this.queue.run(async () => { await this.refreshSession(); return "Reloaded pi resources."; }); }

  private async changePackage(source: string, work: () => Promise<unknown>, ok: string, missing = ok) {
    return this.queue.run(async () => {
      const result = await work();
      await this.settingsManager.flush();
      await this.refreshSession();
      return limitText(result === false ? `${missing}: ${source}` : `${ok}: ${source}`);
    });
  }

  private async requireLoader() { if (!this.resourceLoader) await this.refreshSession(); return this.resourceLoader!; }
  private async requireSession() { if (!this.session) await this.refreshSession(); return this.session!; }

  private async refreshSession() {
    const loader = await createResourceLoader({ ...this.options, agentDir: this.agentDir, settingsManager: this.settingsManager });
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
    this.resourceLoader = loader;
    this.session?.dispose();
    this.session = session;
  }
}
