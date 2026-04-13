import { describe, expect, it } from "vitest";

import { createDiscordRole } from "../src/integrations/discord/tools/discord-admin-role.js";

const context = { authorId: "u", channelId: "c", guildId: "g", isDirectMessage: false };

describe("createDiscordRole", () => {
  it("creates role with and without color", async () => {
    const create = async (input: { color?: number; name: string }) => ({ id: "r", name: input.name, color: input.color });
    const client = Object.assign({} as Parameters<typeof createDiscordRole>[0], {
      guilds: { fetch: async () => ({ id: "g", roles: { create } }) },
    });
    await expect(createDiscordRole(client, context, { name: "mod", colorHex: "#ff00aa", mentionable: true })).resolves.toContain("Created role mod (r)");
    await expect(createDiscordRole(client, context, { name: "plain", colorHex: "ff00aa" })).resolves.toContain("Created role plain (r)");
    await expect(createDiscordRole(client, context, { name: "none" })).resolves.toContain("Created role none (r)");
  });
});
