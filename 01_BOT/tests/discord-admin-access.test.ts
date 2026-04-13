import { describe, expect, it } from "vitest";
import { PermissionFlagsBits } from "discord.js";

import { canUseDiscordManagementTools } from "../src/integrations/discord/tools/discord-admin-access.js";

const context = { authorId: "u", channelId: "c", guildId: "g", isDirectMessage: false };
const permissions = (bits: bigint[]) => ({ has: (bit: bigint) => bits.includes(bit) });

describe("discord admin access", () => {
  it("allows only administrators in current guild", async () => {
    const manageGuildClient = Object.assign({} as Parameters<typeof canUseDiscordManagementTools>[0], {
      channels: {},
      guilds: { fetch: async () => ({ members: { fetch: async () => ({ permissions: permissions([PermissionFlagsBits.ManageGuild]) }) } }) },
    });
    await expect(canUseDiscordManagementTools(manageGuildClient, context)).resolves.toBe(false);
    const adminClient = Object.assign({} as Parameters<typeof canUseDiscordManagementTools>[0], {
      channels: {},
      guilds: { fetch: async () => ({ members: { fetch: async () => ({ permissions: permissions([PermissionFlagsBits.Administrator]) }) } }) },
    });
    await expect(canUseDiscordManagementTools(adminClient, context)).resolves.toBe(true);
  });

  it("rejects dm, missing member, and member without permission", async () => {
    const client = Object.assign({} as Parameters<typeof canUseDiscordManagementTools>[0], {
      channels: {},
      guilds: { fetch: async () => ({ members: { fetch: async () => ({ permissions: permissions([]) }) } }) },
    });
    await expect(canUseDiscordManagementTools(client, { ...context, isDirectMessage: true })).resolves.toBe(false);
    await expect(canUseDiscordManagementTools(client, { ...context, guildId: undefined })).resolves.toBe(false);
    await expect(canUseDiscordManagementTools(client, context)).resolves.toBe(false);
    const missingMember = Object.assign({} as Parameters<typeof canUseDiscordManagementTools>[0], {
      channels: {},
      guilds: { fetch: async () => ({ members: { fetch: async () => Promise.reject(new Error("nope")) } }) },
    });
    await expect(canUseDiscordManagementTools(missingMember, context)).resolves.toBe(false);
  });
});
