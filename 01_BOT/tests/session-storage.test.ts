import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { SessionManager } from "@mariozechner/pi-coding-agent";
import { describe, expect, it } from "vitest";

import { attachmentDirectoryForScope } from "../src/features/chat/attachment-path.js";
import {
  getDiscordSessionContext,
  registerDiscordSessionContext,
} from "../src/integrations/pi/discord-session-context.js";
import { clearScopeSessionStorage } from "../src/integrations/pi/session-admin.js";
import { sessionFileForScope } from "../src/integrations/pi/session-path.js";

describe("session storage", () => {
  it("clears session file, attachment storage, and discord context for scope", async () => {
    const repoRoot = mkdtempSync(join(tmpdir(), "openwaifu-repo-"));
    const sessionsRoot = mkdtempSync(join(tmpdir(), "openwaifu-sessions-"));
    const scopeId = "channel:c:user:u";
    const sessionFile = sessionFileForScope(sessionsRoot, scopeId);
    const sessionManager = SessionManager.open(sessionFile, sessionsRoot, repoRoot);
    sessionManager.appendMessage({ role: "user", content: "hello", timestamp: Date.now() });

    const attachmentsDir = attachmentDirectoryForScope(repoRoot, scopeId);
    mkdirSync(attachmentsDir, { recursive: true });
    writeFileSync(join(attachmentsDir, "note.txt"), "hello");
    registerDiscordSessionContext(sessionFile, scopeId, {
      authorId: "u",
      channelId: "c",
      guildId: "g",
      isDirectMessage: false,
    });

    const result = await clearScopeSessionStorage(repoRoot, sessionsRoot, scopeId);
    expect(result).toEqual({ sessionFile, attachmentsDir, existed: true });
    expect(existsSync(sessionFile)).toBe(false);
    expect(existsSync(attachmentsDir)).toBe(false);
    expect(getDiscordSessionContext(sessionFile)).toBeUndefined();
  });
});
