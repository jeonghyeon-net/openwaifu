import { describe, expect, it, vi } from "vitest";

import { discordContextPrompt } from "../src/integrations/discord/tools/discord-context-prompt";
import { createDiscordManagementTools } from "../src/integrations/discord/tools/discord-management-tools";
import { discordToolResult } from "../src/integrations/discord/tools/discord-tool-result";
import { discordManagementToolNames, type DiscordAdminService } from "../src/integrations/discord/tools/discord-admin-types";

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
    expect(discordContextPrompt({ authorId: "u", channelId: "c", guildId: "g", isDirectMessage: false })).toContain("current_guild_id: g");
    expect(discordContextPrompt({ authorId: "u", channelId: "c", isDirectMessage: true })).toContain("source: dm");
    expect(discordContextPrompt({ authorId: "u", channelId: "c", isDirectMessage: true })).toContain("current_guild_id: none");
    expect(discordToolResult("ok")).toEqual({ content: [{ type: "text", text: "ok" }], details: {} });
  });

  it("includes expected tool names", () => {
    expect(discordManagementToolNames).toEqual(createDiscordManagementTools(service).map((tool) => tool.name));
  });

  it("executes every tool through service layer", async () => {
    const inputs = [{}, { view: "summary" }, { content: "x" }, { name: "n", type: "text" }, { channelId: "c" }, { channelId: "c" }, { name: "r" }, { memberId: "m" }, { memberId: "m", action: "kick" }];
    const outputs = await Promise.all(createDiscordManagementTools(service).map((tool, index) => tool.execute("id", inputs[index], undefined, undefined, { cwd: "/repo" })));
    expect(outputs.map((result) => result.content[0].text)).toEqual(["servers", "inspect", "send", "create-channel", "update-channel", "delete-channel", "create-role", "update-roles", "moderate"]);
  });
});
