// src/persona.ts
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
var PERSONA_FILENAME = "PERSONA";
var personaPathFromModuleUrl = (moduleUrl) => fileURLToPath(new URL(`../${PERSONA_FILENAME}`, moduleUrl));
var readPersonaMarkdown = (personaPath) => {
  try {
    if (!existsSync(personaPath)) return void 0;
    const content = readFileSync(personaPath, "utf8");
    return content.trim().length > 0 ? content : void 0;
  } catch {
    return void 0;
  }
};
var createBeforeAgentStartHandler = (personaPath = personaPathFromModuleUrl(import.meta.url)) => async (event, _ctx) => {
  const personaMarkdown = readPersonaMarkdown(personaPath);
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
