import { describe, expect, it, vi } from "vitest";

import {
  moderateDiscordMember,
  updateDiscordMemberRoles,
} from "../src/integrations/discord/tools/discord-admin-member.js";

const context = { authorId: "u", channelId: "c", guildId: "g", isDirectMessage: false };
const member = {
  id: "m",
  user: { tag: "user#1" },
  roles: { add: vi.fn(async () => undefined), remove: vi.fn(async () => undefined) },
  timeout: vi.fn(async () => undefined),
  setNickname: vi.fn(async () => undefined),
  kick: vi.fn(async () => undefined),
};
const guild = {
  id: "g",
  members: { fetch: async () => member, ban: vi.fn(async () => undefined) },
  bans: { remove: vi.fn(async () => undefined) },
};
const client = Object.assign({} as Parameters<typeof updateDiscordMemberRoles>[0], {
  guilds: { fetch: async () => guild },
});

describe("discord admin member", () => {
  it("updates member roles", async () => {
    await expect(updateDiscordMemberRoles(client, context, { memberId: "m", addRoleIds: ["1"], removeRoleIds: ["2"] })).resolves.toContain("Updated roles for member user#1");
    expect(member.roles.add).toHaveBeenCalledWith(["1"], undefined);
    expect(member.roles.remove).toHaveBeenCalledWith(["2"], undefined);
  });

  it("runs moderation actions", async () => {
    await moderateDiscordMember(client, context, { memberId: "m", action: "ban", deleteMessageSeconds: 1 });
    await moderateDiscordMember(client, context, { memberId: "m", action: "unban" });
    await moderateDiscordMember(client, context, { memberId: "m", action: "timeout", durationMinutes: 2 });
    await moderateDiscordMember(client, context, { memberId: "m", action: "timeout" });
    await moderateDiscordMember(client, context, { memberId: "m", action: "remove_timeout" });
    await moderateDiscordMember(client, context, { memberId: "m", action: "nickname", nickname: "nick" });
    await moderateDiscordMember(client, context, { memberId: "m", action: "nickname" });
    await moderateDiscordMember(client, context, { memberId: "m", action: "kick" });
    expect(guild.members.ban).toHaveBeenCalled();
    expect(guild.bans.remove).toHaveBeenCalled();
    expect(member.timeout).toHaveBeenCalledTimes(3);
    expect(member.timeout).toHaveBeenCalledWith(5 * 60_000, undefined);
    expect(member.setNickname).toHaveBeenCalledWith("nick", undefined);
    expect(member.setNickname).toHaveBeenCalledWith(null, undefined);
    expect(member.kick).toHaveBeenCalled();
  });
});
