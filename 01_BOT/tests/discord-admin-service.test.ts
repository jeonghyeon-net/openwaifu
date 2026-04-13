import { beforeEach, describe, expect, it, vi } from "vitest";

const channel = {
  createDiscordChannel: vi.fn(async () => "create-channel"),
  deleteDiscordChannel: vi.fn(async () => "delete-channel"),
  sendDiscordMessage: vi.fn(async () => "send-message"),
  updateDiscordChannel: vi.fn(async () => "update-channel"),
};
const member = {
  moderateDiscordMember: vi.fn(async () => "moderate-member"),
  updateDiscordMemberRoles: vi.fn(async () => "update-member-roles"),
};
const read = {
  inspectDiscordServer: vi.fn(async () => "inspect-server"),
  listDiscordServers: vi.fn(async () => "list-servers"),
};
const role = { createDiscordRole: vi.fn(async () => "create-role") };
vi.mock("../src/integrations/discord/tools/discord-admin-channel", () => channel);
vi.mock("../src/integrations/discord/tools/discord-admin-member", () => member);
vi.mock("../src/integrations/discord/tools/discord-admin-read", () => read);
vi.mock("../src/integrations/discord/tools/discord-admin-role", () => role);

beforeEach(() => Object.values({ ...channel, ...member, ...read, ...role }).forEach((fn) => fn.mockClear()));

describe("createDiscordAdminService", () => {
  it("delegates every operation", async () => {
    const { createDiscordAdminService } = await import("../src/integrations/discord/tools/discord-admin-service");
    const service = createDiscordAdminService({} as object, { authorId: "u", channelId: "c", guildId: "g", isDirectMessage: false });
    await Promise.all([service.listServers(), service.inspectServer({ view: "summary" }), service.sendMessage({ content: "x" }), service.createChannel({ name: "n", type: "text" }), service.updateChannel({ channelId: "c" }), service.deleteChannel({ channelId: "c" }), service.createRole({ name: "r" }), service.updateMemberRoles({ memberId: "m" }), service.moderateMember({ memberId: "m", action: "kick" })]);
    expect(read.listDiscordServers).toHaveBeenCalled();
    expect(read.inspectDiscordServer).toHaveBeenCalled();
    expect(channel.sendDiscordMessage).toHaveBeenCalled();
    expect(channel.createDiscordChannel).toHaveBeenCalled();
    expect(channel.updateDiscordChannel).toHaveBeenCalled();
    expect(channel.deleteDiscordChannel).toHaveBeenCalled();
    expect(role.createDiscordRole).toHaveBeenCalled();
    expect(member.updateDiscordMemberRoles).toHaveBeenCalled();
    expect(member.moderateDiscordMember).toHaveBeenCalled();
  });
});
