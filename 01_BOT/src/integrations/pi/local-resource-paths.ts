import { readdir } from "node:fs/promises";
import { join } from "node:path";

export const listLocalExtensionRoots = async (root: string): Promise<string[]> => {
  try {
    const entries = await readdir(root, { withFileTypes: true });
    return entries.filter((entry) => entry.isDirectory()).map((entry) => join(root, entry.name));
  } catch {
    return [];
  }
};

export const listLocalSkillRoots = async (root: string): Promise<string[]> => {
  try {
    await readdir(root, { withFileTypes: true });
    return [root];
  } catch {
    return [];
  }
};
