import { existsSync } from "node:fs";

import { SessionManager, type SessionEntry } from "@mariozechner/pi-coding-agent";

import { sessionFileForScope } from "./session-path.js";

export type ScopeSessionStats = {
  sessionFile: string | undefined;
  sessionId: string;
  userMessages: number;
  assistantMessages: number;
  toolCalls: number;
  toolResults: number;
  totalMessages: number;
  tokens: {
    input: number;
    output: number;
    cacheRead: number;
    cacheWrite: number;
    total: number;
  };
  cost: number;
};

const messageEntriesOf = (entries: SessionEntry[]) =>
  entries.filter((entry): entry is Extract<SessionEntry, { type: "message" }> => entry.type === "message");

export const sessionStatsFromEntries = (
  sessionId: string,
  sessionFile: string | undefined,
  entries: SessionEntry[],
): ScopeSessionStats => {
  const messages = messageEntriesOf(entries);
  let toolCalls = 0;
  let totalInput = 0;
  let totalOutput = 0;
  let totalCacheRead = 0;
  let totalCacheWrite = 0;
  let totalCost = 0;

  for (const { message } of messages) {
    if (message.role !== "assistant") continue;
    toolCalls += message.content.filter((block) => block.type === "toolCall").length;
    totalInput += message.usage.input;
    totalOutput += message.usage.output;
    totalCacheRead += message.usage.cacheRead;
    totalCacheWrite += message.usage.cacheWrite;
    totalCost += message.usage.cost.total;
  }

  return {
    sessionFile,
    sessionId,
    userMessages: messages.filter(({ message }) => message.role === "user").length,
    assistantMessages: messages.filter(({ message }) => message.role === "assistant").length,
    toolCalls,
    toolResults: messages.filter(({ message }) => message.role === "toolResult").length,
    totalMessages: messages.length,
    tokens: {
      input: totalInput,
      output: totalOutput,
      cacheRead: totalCacheRead,
      cacheWrite: totalCacheWrite,
      total: totalInput + totalOutput + totalCacheRead + totalCacheWrite,
    },
    cost: totalCost,
  };
};

export const sessionStatsFromManager = (
  sessionManager: Pick<SessionManager, "getEntries" | "getSessionFile" | "getSessionId">,
): ScopeSessionStats => sessionStatsFromEntries(
  sessionManager.getSessionId(),
  sessionManager.getSessionFile(),
  sessionManager.getEntries(),
);

export const readScopeSessionStats = (
  repoRoot: string,
  sessionsRoot: string,
  scopeId: string,
): ScopeSessionStats | undefined => {
  const sessionFile = sessionFileForScope(sessionsRoot, scopeId);
  if (!existsSync(sessionFile)) return undefined;
  return sessionStatsFromManager(SessionManager.open(sessionFile, sessionsRoot, repoRoot));
};
