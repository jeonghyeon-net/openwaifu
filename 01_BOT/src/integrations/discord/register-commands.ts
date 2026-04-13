import type { Client } from "discord.js";

import { slashCommands } from "./commands.js";

export const registerSlashCommands = async (client: Client<true>, guildId?: string) => {
  if (guildId) {
    const guild = await client.guilds.fetch(guildId);
    await guild.commands.set(slashCommands);
    return "guild";
  }

  await client.application.commands.set(slashCommands);
  return "global";
};
