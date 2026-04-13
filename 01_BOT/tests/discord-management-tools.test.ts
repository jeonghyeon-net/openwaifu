import type { ExtensionContext } from "@mariozechner/pi-coding-agent";
import { describe, expect, it, vi } from "vitest";

import { discordContextPrompt } from "../src/integrations/discord/tools/discord-context-prompt.js";
import { createDiscordManagementTools } from "../src/integrations/discord/tools/discord-management-tools.js";
import { discordToolResult } from "../src/integrations/discord/tools/discord-tool-result.js";
import { discordManagementToolNames, type DiscordAdminService } from "../src/integrations/discord/tools/discord-admin-types.js";

const service = {
  listServers: vi.fn(async () => "servers"),
  inspectServer: vi.fn(async () => "inspect"),
  sendMessage: vi.fn(async () => "send"),
  createChannel: vi.fn(async () => "create-channel"),
  updateChannel: vi.fn(async () => "update-channel"),
  deleteChannel: vi.fn(async () => "delete-channel"),
  createRole: vi.fn(async () => "create-role"),
  updateMemberRoles: vi.fn(async () => "update-roles"),
  moderateMember: vi.fn(async () => "moderate"),
} satisfies DiscordAdminService;

describe("discord management tools", () => {
  it("builds prompt and text results", () => {
    const guildPrompt = discordContextPrompt({ authorId: "u", channelId: "c", channelName: "개발", guildId: "g", guildName: "jeonghyeon.net", isDirectMessage: false });
    const dmPrompt = discordContextPrompt({ authorId: "u", channelId: "c", isDirectMessage: true });
    expect(guildPrompt).toContain("current_guild_id: g");
    expect(guildPrompt).toContain("current_guild_name: jeonghyeon.net");
    expect(guildPrompt).toContain("current_channel_name: 개발");
    expect(dmPrompt).toContain("source: dm");
    expect(dmPrompt).toContain("current_guild_id: none");
    expect(dmPrompt).not.toContain("current_channel_name:");
    expect(discordToolResult("ok")).toEqual({ content: [{ type: "text", text: "ok" }], details: {} });
  });

  it("includes expected tool names", () => {
    expect(discordManagementToolNames).toEqual(createDiscordManagementTools(service).map((tool: { name: string }) => tool.name));
  });

  it("executes every tool through service layer", async () => {
    const inputs = [{}, { view: "summary" }, { content: "x" }, { name: "n", type: "text" }, { channelId: "c" }, { channelId: "c" }, { name: "r" }, { memberId: "m" }, { memberId: "m", action: "kick" }];
    const context = Object.assign({} as ExtensionContext, { cwd: "/repo" });
    const outputs = await Promise.all(createDiscordManagementTools(service).map((tool: { execute: Function }, index: number) => tool.execute("id", inputs[index], undefined, undefined, context)));
    expect(outputs.map((result: { content: Array<{ type: string; text?: string }> }) => {
      const first = result.content[0];
      return first && "text" in first ? first.text : "";
    })).toEqual(["servers", "inspect", "send", "create-channel", "update-channel", "delete-channel", "create-role", "update-roles", "moderate"]);
  });
});
