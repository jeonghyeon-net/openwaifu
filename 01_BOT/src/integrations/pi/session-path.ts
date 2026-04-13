import { join } from "node:path";

const sanitizeScope = (scopeId: string) => scopeId.replace(/[^a-zA-Z0-9._-]/g, "_");

export const sessionFileForScope = (sessionsRoot: string, scopeId: string) =>
  join(sessionsRoot, `${sanitizeScope(scopeId)}.jsonl`);

export const sessionFileForScheduledRun = (
  sessionsRoot: string,
  scopeId: string,
  taskId: string,
  runId = new Date().toISOString(),
) => join(sessionsRoot, `scheduled__${sanitizeScope(scopeId)}__${sanitizeScope(taskId)}__${sanitizeScope(runId)}.jsonl`);
