import { defineTool } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";

import type { DiscordAdminService } from "./discord-admin-types.js";
import { discordToolResult } from "./discord-tool-result.js";

export const createListServersTool = (service: DiscordAdminService) =>
  defineTool({
    name: "discord_list_servers",
    label: "Discord List Servers",
    description: "List Discord servers current bot can inspect or manage.",
    promptSnippet: "`discord_list_servers`: list Discord servers bot can manage",
    parameters: Type.Object({}),
    execute: async () => discordToolResult(await service.listServers()),
  });
