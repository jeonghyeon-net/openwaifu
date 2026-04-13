import { describe, expect, it } from "vitest";
import { GatewayIntentBits, Partials } from "discord.js";

import { createDiscordClient } from "../src/integrations/discord/client.js";

describe("discord client", () => {
  it("creates client with required intents and partials", () => {
    const client = createDiscordClient();
    expect(client.options.intents.has(GatewayIntentBits.GuildMembers)).toBe(true);
    expect(client.options.intents.has(GatewayIntentBits.MessageContent)).toBe(true);
    expect(client.options.partials).toContain(Partials.Channel);
    client.destroy();
  });
});
