import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const configFile = fileURLToPath(import.meta.url);
const configDir = dirname(configFile);
const srcRoot = resolve(configDir, "..");
const botRoot = resolve(srcRoot, "..");
const repoRoot = resolve(botRoot, "..");

export const paths = {
  srcRoot,
  botRoot,
  repoRoot,
  dataRoot: resolve(botRoot, ".data"),
  sessionsRoot: resolve(botRoot, ".data", "sessions"),
  extensionsRoot: resolve(repoRoot, "02_EXTENSIONS"),
  skillsRoot: resolve(repoRoot, "03_SKILLS"),
};
