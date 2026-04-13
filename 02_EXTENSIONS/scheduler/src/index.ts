import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

import { createSchedulerTool } from "./tool.js";

export default function (pi: ExtensionAPI) {
  pi.registerTool(createSchedulerTool());
}
