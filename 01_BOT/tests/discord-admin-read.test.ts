import { describe, expect, it } from "vitest";

import { inspectDiscordServer, listDiscordServers } from "../src/integrations/discord/tools/discord-admin-read.js";

const context = { authorId: "u", channelId: "c", guildId: "g", isDirectMessage: false };
const channels = {
  filter: () => ({ size: 2 }),
  values: () => [null, { id: "1", name: "alpha", rawPosition: 2, type: 0 }, { id: "2", name: "beta", rawPosition: 1, type: 0 }][Symbol.iterator](),
};
const roles = {
  filter: () => ({ size: 2 }),
  values: () => [null, { id: "1", name: "role-a", position: 1, mentionable: true }, { id: "2", name: "role-b", position: 2, mentionable: false }][Symbol.iterator](),
};
const guild = {
  id: "g",
  name: "Guild",
  memberCount: 2,
  channels: { fetch: async () => channels },
  roles: { fetch: async () => roles },
  members: {
    fetch: async () =>
      new Map([
        [
          "1",
          { id: "1", user: { tag: "a#1" }, roles: { cache: { filter: () => [{ name: "role-a" }] } } },
        ],
        [
          "2",
          { id: "2", user: { tag: "b#2" }, roles: { cache: { filter: () => [] } } },
        ],
      ]),
  },
};
const client = {
  guilds: {
    fetch: async (id?: string) =>
      id ? guild : new Map([["g", { id: "g", name: "Guild" }], ["x", { id: "x", name: "Other" }]]),
    cache: new Map([["g", { id: "g", name: "Guild" }], ["x", { id: "x", name: "Other" }]]),
  },
} as Parameters<typeof listDiscordServers>[0];

describe("discord admin read", () => {
  it("lists visible servers", async () => {
    await expect(listDiscordServers(client, context)).resolves.toContain("Guild (g) [current]");
  });

  it("inspects summary, channels, roles, and members", async () => {
    await expect(inspectDiscordServer(client, context, { view: "summary" })).resolves.toContain("members: 2");
    await expect(inspectDiscordServer(client, context, { view: "channels" })).resolves.toContain("beta (2)");
    await expect(inspectDiscordServer(client, context, { view: "roles" })).resolves.toContain("role-b (2)");
    await expect(listDiscordServers(client, { ...context, guildId: "none" })).resolves.toContain("Other (x)");
    const members = await inspectDiscordServer(client, context, { view: "members" });
    expect(members).toContain("a#1 (1) roles=role-a");
    expect(members).toContain("b#2 (2) roles=none");
  });
});
