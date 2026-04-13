import { Events } from "discord.js";

import { env } from "./config/env.js";
import { paths } from "./config/paths.js";
import { createChatService } from "./features/chat/chat-service.js";
import { remindersFileForCwd } from "./features/scheduler/reminder-paths.js";
import { createReminderService } from "./features/scheduler/reminder-service.js";
import { createDiscordClient } from "./integrations/discord/client.js";
import { registerDiscordHandlers } from "./integrations/discord/handlers.js";
import { PiRuntime } from "./integrations/pi/pi-runtime.js";

const client = createDiscordClient();
const runtime = await PiRuntime.create({
  repoRoot: paths.repoRoot,
  sessionsRoot: paths.sessionsRoot,
  extensionsRoot: paths.extensionsRoot,
  skillsRoot: paths.skillsRoot,
  provider: env.piProvider,
  modelId: env.piModel,
  thinkingLevel: env.piThinkingLevel,
  reasoningEffort: env.piReasoningEffort,
  discordClient: client,
});

const reminderService = createReminderService({
  client,
  remindersFile: remindersFileForCwd(paths.repoRoot),
});

registerDiscordHandlers({ client, chatService: createChatService(runtime) });
client.once(Events.ClientReady, (readyClient) => {
  console.log(`Logged in as ${readyClient.user.tag}`);
  reminderService.start();
});
void client.login(env.discordBotToken);
