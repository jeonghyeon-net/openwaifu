import { Events } from "discord.js";

import { env } from "./config/env.js";
import { paths } from "./config/paths.js";
import { createChatService } from "./features/chat/chat-service.js";
import { createPiAdminService } from "./features/pi-admin/pi-admin-service.js";
import { createDiscordClient } from "./integrations/discord/client.js";
import { registerDiscordHandlers } from "./integrations/discord/handlers.js";
import { registerSlashCommands } from "./integrations/discord/register-commands.js";
import { PiRuntime } from "./integrations/pi/pi-runtime.js";

const runtime = await PiRuntime.create({
  repoRoot: paths.repoRoot,
  extensionsRoot: paths.extensionsRoot,
  skillsRoot: paths.skillsRoot,
  modelId: env.piModel,
});

const chatService = createChatService(runtime);
const piAdminService = createPiAdminService(runtime);
const client = createDiscordClient();

registerDiscordHandlers({ client, chatService, piAdminService });

client.once(Events.ClientReady, async (readyClient) => {
  const scope = await registerSlashCommands(readyClient, env.discordGuildId);
  console.log(`Logged in as ${readyClient.user.tag} (${scope} commands synced)`);
});

void client.login(env.discordBotToken);
