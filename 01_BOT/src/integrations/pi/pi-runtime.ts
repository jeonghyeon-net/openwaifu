import { mkdir } from "node:fs/promises";
import type { Client } from "discord.js";
import {
  AuthStorage,
  ModelRegistry,
  SessionManager,
  SettingsManager,
  getAgentDir,
  type AgentSession,
  type DefaultResourceLoader,
} from "@mariozechner/pi-coding-agent";
import { loadDiscordAdminAccess, type DiscordAdminAccess } from "../discord/tools/discord-admin-access.js";
import type { DiscordToolContext } from "../discord/tools/discord-admin-types.js";
import { createPiSession } from "./create-session.js";
import { createResourceLoader } from "./create-resource-loader.js";
import { lastAssistantText } from "./last-assistant-text.js";
import { SerialQueue } from "./serial-queue.js";
import { sessionFileForScope } from "./session-path.js";

type CachedSession = { accessKey: string; session: AgentSession };
export type PiRuntimeOptions = {
  repoRoot: string;
  sessionsRoot: string;
  extensionsRoot: string;
  skillsRoot: string;
  modelId: string;
  discordClient: Client;
  discordAdminUserIds: string[];
};
const accessKeyOf = (access: DiscordAdminAccess) => `${access.enabled}:${access.scopeGuildId ?? "*"}`;

export class PiRuntime {
  private readonly agentDir = getAgentDir();
  private readonly authStorage = AuthStorage.create();
  private readonly modelRegistry = ModelRegistry.create(this.authStorage);
  private readonly settingsManager: SettingsManager;
  private readonly queue = new SerialQueue();
  private readonly sessions = new Map<string, CachedSession>();
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

  prompt(scopeId: string, prompt: string, discordContext: DiscordToolContext) {
    return this.queue.run(async () => {
      const access = await loadDiscordAdminAccess(this.options.discordClient, discordContext, this.options.discordAdminUserIds);
      const session = await this.getSession(scopeId, discordContext, access);
      await session.prompt(prompt);
      return lastAssistantText(session);
    });
  }

  private async getSession(scopeId: string, discordContext: DiscordToolContext, access: DiscordAdminAccess) {
    const cached = this.sessions.get(scopeId);
    if (cached && cached.accessKey === accessKeyOf(access)) return cached.session;
    if (cached) cached.session.dispose();
    const session = await createPiSession({
      repoRoot: this.options.repoRoot,
      agentDir: this.agentDir,
      authStorage: this.authStorage,
      modelRegistry: this.modelRegistry,
      model: this.model,
      settingsManager: this.settingsManager,
      resourceLoader: this.loader,
      sessionManager: SessionManager.open(sessionFileForScope(this.options.sessionsRoot, scopeId), this.options.sessionsRoot, this.options.repoRoot),
      discordClient: this.options.discordClient,
      discordContext,
      discordAdminAccess: access,
    });
    this.sessions.set(scopeId, { accessKey: accessKeyOf(access), session });
    return session;
  }
}
