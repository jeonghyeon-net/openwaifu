import {
  AuthStorage,
  createAgentSession,
  DefaultPackageManager,
  DefaultResourceLoader,
  getAgentDir,
  ModelRegistry,
  SessionManager,
  SettingsManager,
  type AgentSession,
} from "@mariozechner/pi-coding-agent";

import { listLocalExtensionRoots, listLocalSkillRoots } from "./local-resource-paths.js";

const limitText = (text: string) => (text.length > 1900 ? `${text.slice(0, 1885)}\n\n(truncated)` : text);
const formatList = (title: string, items: string[]) => `${title}\n${items.length ? items.map((item) => `- ${item}`).join("\n") : "- none"}`;

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
  private readonly model;
  private readonly repoRoot: string;
  private readonly extensionsRoot: string;
  private readonly skillsRoot: string;
  private resourceLoader?: DefaultResourceLoader;
  private session?: AgentSession;
  private queue: Promise<unknown> = Promise.resolve();

  private constructor(options: PiRuntimeOptions) {
    this.repoRoot = options.repoRoot;
    this.extensionsRoot = options.extensionsRoot;
    this.skillsRoot = options.skillsRoot;
    this.settingsManager = SettingsManager.create(this.repoRoot, this.agentDir);
    this.packageManager = new DefaultPackageManager({
      cwd: this.repoRoot,
      agentDir: this.agentDir,
      settingsManager: this.settingsManager,
    });

    const model = this.modelRegistry.find("anthropic", options.modelId);
    if (!model) throw new Error(`Model not found: anthropic/${options.modelId}`);
    this.model = model;
  }

  static async create(options: PiRuntimeOptions) {
    const runtime = new PiRuntime(options);
    await runtime.refreshSession();
    return runtime;
  }

  async prompt(prompt: string) {
    return this.runQueued(async () => {
      const session = await this.getSession();
      await session.prompt(prompt);
      return this.lastAssistantText(session);
    });
  }

  async listPackages() {
    return this.runQueued(async () => {
      const packages = this.packageManager.listConfiguredPackages();
      const text = packages.length
        ? packages
            .map((pkg) => `[${pkg.scope}] ${pkg.source}${pkg.installedPath ? `\n  ${pkg.installedPath}` : ""}`)
            .join("\n")
        : "No configured pi packages.";
      return limitText(text);
    });
  }

  async listResources() {
    return this.runQueued(async () => {
      const loader = await this.getResourceLoader();
      const text = [
        formatList("extensions", loader.getExtensions().extensions.map((item) => item.path)),
        formatList("skills", loader.getSkills().skills.map((item) => `${item.name} (${item.filePath})`)),
        formatList("prompts", loader.getPrompts().prompts.map((item) => `${item.name} (${item.filePath})`)),
        formatList("themes", loader.getThemes().themes.map((item) => item.sourcePath ?? item.name ?? "(unnamed)")),
      ].join("\n\n");
      return limitText(text);
    });
  }

  async installPackage(source: string) {
    return this.runQueued(async () => {
      await this.packageManager.installAndPersist(source, { local: true });
      await this.settingsManager.flush();
      await this.refreshSession();
      return limitText(`Installed: ${source}`);
    });
  }

  async removePackage(source: string) {
    return this.runQueued(async () => {
      const removed = await this.packageManager.removeAndPersist(source, { local: true });
      await this.settingsManager.flush();
      await this.refreshSession();
      return limitText(removed ? `Removed: ${source}` : `Not found: ${source}`);
    });
  }

  async reloadResources() {
    return this.runQueued(async () => {
      await this.refreshSession();
      return "Reloaded pi resources.";
    });
  }

  private async getSession() {
    if (!this.session) {
      await this.refreshSession();
    }
    return this.session!;
  }

  private async getResourceLoader() {
    if (!this.resourceLoader) {
      await this.refreshSession();
    }
    return this.resourceLoader!;
  }

  private async refreshSession() {
    const nextLoader = await this.createResourceLoader();
    await nextLoader.reload();

    const { session } = await createAgentSession({
      cwd: this.repoRoot,
      agentDir: this.agentDir,
      authStorage: this.authStorage,
      modelRegistry: this.modelRegistry,
      model: this.model,
      settingsManager: this.settingsManager,
      resourceLoader: nextLoader,
      sessionManager: this.sessionManager,
      tools: [],
    });

    session.agent.state.systemPrompt = [
      "You are concise Discord chat bot.",
      "Reply in user's language.",
      "Pi package management happens through Discord slash command /pi.",
    ].join("\n");
    await session.bindExtensions({});

    const previous = this.session;
    this.resourceLoader = nextLoader;
    this.session = session;
    previous?.dispose();
  }

  private async createResourceLoader() {
    const additionalExtensionPaths = await listLocalExtensionRoots(this.extensionsRoot);
    const additionalSkillPaths = await listLocalSkillRoots(this.skillsRoot);

    return new DefaultResourceLoader({
      cwd: this.repoRoot,
      agentDir: this.agentDir,
      settingsManager: this.settingsManager,
      additionalExtensionPaths,
      additionalSkillPaths,
    });
  }

  private lastAssistantText(session: AgentSession) {
    const last = [...session.messages].reverse().find((message) => message.role === "assistant");
    if (!last || !("content" in last) || !Array.isArray(last.content)) return "응답 없음";

    const text = last.content
      .filter((part) => part.type === "text" && "text" in part)
      .map((part) => part.text)
      .join("\n")
      .trim();

    return text ? limitText(text) : "응답 없음";
  }

  private runQueued<T>(job: () => Promise<T>): Promise<T> {
    const next = this.queue.then(job, job);
    this.queue = next.then(
      () => undefined,
      () => undefined,
    );
    return next;
  }
}
