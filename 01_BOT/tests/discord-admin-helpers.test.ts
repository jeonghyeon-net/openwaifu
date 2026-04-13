import { describe, expect, it } from "vitest";

import {
  formatBlock,
  requireGuild,
  requireGuildChannel,
  requireGuildMember,
  requireSendableChannel,
} from "../src/integrations/discord/tools/discord-admin-helpers";

const context = { authorId: "u", channelId: "c", guildId: "g", isDirectMessage: false };

describe("discord admin helpers", () => {
  it("formats blocks and resolves guild by explicit or contextual id", async () => {
    const guild = { id: "g" };
    const client = { guilds: { fetch: async (id: string) => (id === "g" ? guild : Promise.reject(new Error())) } };
    expect(formatBlock("title", [])).toBe("title\n- none");
    await expect(requireGuild(client as Parameters<typeof requireGuild>[0], context, "g")).resolves.toBe(guild);
    await expect(requireGuild(client as Parameters<typeof requireGuild>[0], context, undefined)).resolves.toBe(guild);
    await expect(requireGuild(client as Parameters<typeof requireGuild>[0], { ...context, guildId: undefined }, undefined)).rejects.toThrow("guild_id required");
    await expect(requireGuild(client as Parameters<typeof requireGuild>[0], context, "x")).rejects.toThrow("Guild not found: x");
  });

  it("checks guild members and channels", async () => {
    const guild = { id: "g", members: { fetch: async (id: string) => (id === "u" ? { id } : Promise.reject(new Error())) } };
    const textChannel = { id: "c", guildId: "g", isTextBased: () => true, send: async () => undefined, isDMBased: () => false, delete: async () => undefined };
    const dmChannel = { isDMBased: () => true };
    const client = { channels: { fetch: async (id: string) => (id === "c" ? textChannel : id === "dm" ? dmChannel : null) } };
    await expect(requireGuildMember(guild as Parameters<typeof requireGuildMember>[0], "u")).resolves.toMatchObject({ id: "u" });
    await expect(requireGuildMember(guild as Parameters<typeof requireGuildMember>[0], "x")).rejects.toThrow("Member not found");
    await expect(requireSendableChannel(client as Parameters<typeof requireSendableChannel>[0], "c")).resolves.toBe(textChannel);
    await expect(requireSendableChannel(client as Parameters<typeof requireSendableChannel>[0], "x")).rejects.toThrow("Channel not sendable");
    await expect(requireGuildChannel(client as Parameters<typeof requireGuildChannel>[0], "c")).resolves.toBe(textChannel);
    await expect(requireGuildChannel(client as Parameters<typeof requireGuildChannel>[0], "dm")).rejects.toThrow("Guild channel not found");
  });
});
