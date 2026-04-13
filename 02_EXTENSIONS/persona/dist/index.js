// src/persona.ts
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
var PERSONA_FILENAME = "PERSONA";
var PERSONA_RELATIVE_PATH = join(
  "02_EXTENSIONS",
  "persona",
  PERSONA_FILENAME
);
var personaPathForCwd = (cwd) => join(cwd, PERSONA_RELATIVE_PATH);
var readPersonaMarkdown = (personaPath) => {
  try {
    if (!existsSync(personaPath)) return void 0;
    const content = readFileSync(personaPath, "utf8");
    return content.trim().length > 0 ? content : void 0;
  } catch {
    return void 0;
  }
};
var createBeforeAgentStartHandler = (personaPath) => async (event, ctx) => {
  const resolvedPath = personaPath ?? personaPathForCwd(ctx.cwd);
  const personaMarkdown = readPersonaMarkdown(resolvedPath);
  if (!personaMarkdown) return void 0;
  return {
    systemPrompt: `${event.systemPrompt}

${personaMarkdown}`
  };
};

// src/index.ts
function index_default(pi) {
  pi.on("before_agent_start", createBeforeAgentStartHandler());
}
export {
  index_default as default
};
