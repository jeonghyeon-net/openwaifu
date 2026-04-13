import { describe, expect, it } from "vitest";

import {
  discordSessionCommands,
  syncDiscordSessionCommands,
} from "../src/integrations/discord/session-commands.js";
import {
  createSessionCommandEnv,
  discordInteraction,
} from "./discord-session-command-test-helpers.js";

describe("discord session command sync", () => {
  it("syncs slash command metadata", async () => {
    const set = async (..._args: unknown[]) => undefined;
    const calls: unknown[][] = [];
    await syncDiscordSessionCommands({ application: { commands: { set: async (...args) => (calls.push(args), set(...args)) } } });
    expect(calls).toEqual([[discordSessionCommands]]);
  });

  it("fails fast when Discord application is unavailable", async () => {
    await expect(syncDiscordSessionCommands({ application: null })).rejects.toThrow("Discord application unavailable");
  });

  it("ignores non-chat interactions", async () => {
    const { sessionService, run } = createSessionCommandEnv();
    const interaction = discordInteraction({ isChatInputCommand: () => false });
    await run(interaction);
    expect(sessionService.getScopeStats).not.toHaveBeenCalled();
    expect(sessionService.resetScope).not.toHaveBeenCalled();
    expect(interaction.reply).not.toHaveBeenCalled();
  });

  it("ignores unrelated chat input commands", async () => {
    const { sessionService, run } = createSessionCommandEnv();
    const interaction = discordInteraction({ commandName: "other" });
    await run(interaction);
    expect(sessionService.getScopeStats).not.toHaveBeenCalled();
    expect(sessionService.resetScope).not.toHaveBeenCalled();
    expect(interaction.reply).not.toHaveBeenCalled();
  });
});
