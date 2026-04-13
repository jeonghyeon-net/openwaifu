import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

import { createBeforeAgentStartHandler } from "./persona.js";

export default function (pi: ExtensionAPI) {
	pi.on("before_agent_start", createBeforeAgentStartHandler());
}
