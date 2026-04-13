import { describe, expect, it, vi } from "vitest";
import { ChannelType } from "discord.js";

import {
  createDiscordChannel,
  deleteDiscordChannel,
  sendDiscordMessage,
  updateDiscordChannel,
} from "../src/integrations/discord/tools/discord-admin-channel.js";

const context = { authorId: "u", channelId: "c", guildId: "g", isDirectMessage: false };

describe("discord admin channel", () => {
  it("sends, creates, updates, and deletes channels", async () => {
    const text = {
      id: "c",
      name: "general",
      type: ChannelType.GuildText,
      guildId: "g",
      isTextBased: () => true,
      isDMBased: () => false,
      send: async () => ({ id: "m" }),
      edit: vi.fn(async () => undefined),
      setParent: vi.fn(async () => undefined),
      setTopic: vi.fn(async () => undefined),
      delete: vi.fn(async () => undefined),
    };
    const client = Object.assign({} as Parameters<typeof sendDiscordMessage>[0], {
      channels: { fetch: async () => text },
      guilds: { fetch: async () => ({ id: "g", channels: { create: async ({ name }: { name: string }) => ({ id: "n", name }) } }) },
    });
    await expect(sendDiscordMessage(client, context, { content: "hi" })).resolves.toContain("Sent message m");
    await expect(createDiscordChannel(client, context, { name: "ops", type: "text" })).resolves.toContain("Created channel ops (n)");
    await expect(updateDiscordChannel(client, { channelId: "c", name: "renamed", categoryId: "cat", topic: "topic" })).resolves.toContain("Updated channel general (c)");
    await expect(updateDiscordChannel(client, { channelId: "c", categoryId: "", topic: "" })).resolves.toContain("Updated channel general (c)");
    await expect(deleteDiscordChannel(client, { channelId: "c" })).resolves.toContain("Deleted channel general (c)");
    expect(text.edit).toHaveBeenCalled();
    expect(text.setParent).toHaveBeenCalledWith(null, { reason: undefined });
    expect(text.setTopic).toHaveBeenCalledWith(null, undefined);
    expect(text.delete).toHaveBeenCalled();
  });

  it("covers forum, announcement, and voice channel branches", async () => {
    const forum = { id: "f", name: "forum", type: ChannelType.GuildForum, guildId: "g", isDMBased: () => false, delete: async () => undefined, setTopic: vi.fn(async () => undefined) };
    const announcement = { id: "a", name: "news", type: ChannelType.GuildAnnouncement, guildId: "g", isDMBased: () => false, delete: async () => undefined, setTopic: vi.fn(async () => undefined) };
    const client = Object.assign({} as Parameters<typeof createDiscordChannel>[0], {
      channels: { fetch: async (id: string) => (id === "f" ? forum : announcement) },
      guilds: { fetch: async () => ({ id: "g", channels: { create: async ({ name, type }: { name: string; type: ChannelType }) => ({ id: name, name, type }) } }) },
    });
    await expect(createDiscordChannel(client, context, { name: "voice", type: "voice" })).resolves.toContain("Created channel voice (voice)");
    await expect(createDiscordChannel(client, context, { name: "forum", type: "forum" })).resolves.toContain("Created channel forum (forum)");
    await expect(createDiscordChannel(client, context, { name: "news", type: "announcement" })).resolves.toContain("Created channel news (news)");
    await expect(updateDiscordChannel(client, { channelId: "f", topic: "forum-topic" })).resolves.toContain("Updated channel forum (f)");
    await expect(updateDiscordChannel(client, { channelId: "a", topic: "news-topic" })).resolves.toContain("Updated channel news (a)");
  });

  it("updates channels without optional setters", async () => {
    const bare = { id: "b", name: "bare", type: ChannelType.GuildText, guildId: "g", isDMBased: () => false, delete: async () => undefined, edit: vi.fn(async () => undefined) };
    const client = Object.assign({} as Parameters<typeof updateDiscordChannel>[0], { channels: { fetch: async () => bare } });
    await expect(updateDiscordChannel(client, { channelId: "b", name: "renamed" })).resolves.toContain("Updated channel bare (b)");
  });

  it("rejects unsupported topic updates", async () => {
    const voice = { id: "v", name: "voice", type: ChannelType.GuildVoice, guildId: "g", isDMBased: () => false, delete: async () => undefined };
    const client = Object.assign({} as Parameters<typeof updateDiscordChannel>[0], { channels: { fetch: async () => voice } });
    await expect(updateDiscordChannel(client, { channelId: "v", topic: "x" })).rejects.toThrow("does not support topic");
  });
});
