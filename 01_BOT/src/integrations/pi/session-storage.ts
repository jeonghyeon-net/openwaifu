import { existsSync } from "node:fs";
import { rm } from "node:fs/promises";

import { attachmentDirectoryForScope } from "../../features/chat/attachment-path.js";
import { clearDiscordSessionContext } from "./discord-session-context.js";
import { sessionFileForScope } from "./session-path.js";

export const clearScopeSessionStorage = async (
  repoRoot: string,
  sessionsRoot: string,
  scopeId: string,
) => {
  const sessionFile = sessionFileForScope(sessionsRoot, scopeId);
  const attachmentsDir = attachmentDirectoryForScope(repoRoot, scopeId);
  const existed = existsSync(sessionFile) || existsSync(attachmentsDir);
  await Promise.all([
    rm(sessionFile, { force: true }),
    rm(attachmentsDir, { recursive: true, force: true }),
  ]);
  clearDiscordSessionContext(sessionFile);
  return { sessionFile, attachmentsDir, existed };
};
