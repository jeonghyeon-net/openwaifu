import { DefaultResourceLoader, type SettingsManager } from "@mariozechner/pi-coding-agent";

import { listLocalExtensionRoots, listLocalSkillRoots } from "./local-resource-paths.js";

type CreateResourceLoaderOptions = {
  repoRoot: string;
  agentDir: string;
  settingsManager: SettingsManager;
  extensionsRoot: string;
  skillsRoot: string;
};

export const createResourceLoader = async ({
  repoRoot,
  agentDir,
  settingsManager,
  extensionsRoot,
  skillsRoot,
}: CreateResourceLoaderOptions) =>
  new DefaultResourceLoader({
    cwd: repoRoot,
    agentDir,
    settingsManager,
    additionalExtensionPaths: await listLocalExtensionRoots(extensionsRoot),
    additionalSkillPaths: await listLocalSkillRoots(skillsRoot),
  });
