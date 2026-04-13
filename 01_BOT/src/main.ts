import { Events } from "discord.js";

import { env } from "./config/env.js";
import { paths } from "./config/paths.js";
import { createChatService } from "./features/chat/chat-service.js";
import { createChatGptQuotaStatusService } from "./features/chatgpt-quota/chatgpt-quota-service.js";
import { schedulerFileForCwd } from "./features/scheduler/scheduler-paths.js";
import { createSchedulerService } from "./features/scheduler/scheduler-service.js";
import { createDiscordClient } from "./integrations/discord/client.js";
import { registerDiscordHandlers } from "./integrations/discord/handlers.js";
import { createDiscordPresenceService } from "./integrations/discord/presence-service.js";
import { registerDiscordSessionHandlers, syncDiscordSessionCommands } from "./integrations/discord/session-commands.js";
import { PiRuntime } from "./integrations/pi/pi-runtime.js";

const client = createDiscordClient();
const runtime = await PiRuntime.create({
  repoRoot: paths.repoRoot,
  sessionsRoot: paths.sessionsRoot,
  extensionsRoot: paths.extensionsRoot,
  skillsRoot: paths.skillsRoot,
  modelId: env.piModel,
  thinkingLevel: env.piThinkingLevel,
  discordClient: client,
});

const schedulerService = createSchedulerService({
  tasksFile: schedulerFileForCwd(paths.repoRoot),
  runTask: async (scheduledTask) => {
    await runtime.runScheduledPrompt(
      scheduledTask.scopeId,
      scheduledTask.id,
      scheduledTask.prompt,
      {
        authorId: scheduledTask.authorId,
        channelId: scheduledTask.channelId,
        channelName: scheduledTask.channelName,
        guildId: scheduledTask.guildId,
        guildName: scheduledTask.guildName,
        isDirectMessage: scheduledTask.isDirectMessage,
      },
    );
  },
});
const presenceService = createDiscordPresenceService(client);
const chatGptQuotaStatusService = createChatGptQuotaStatusService({
  onStatusText: (text) => presenceService.setCustomStatus(text),
  onError: (error) => console.error("ChatGPT quota status update failed", error),
});

registerDiscordHandlers({ client, chatService: createChatService(runtime), presenceService });
registerDiscordSessionHandlers({ client, sessionService: runtime });
client.once(Events.ClientReady, (readyClient) => {
  console.log(`Logged in as ${readyClient.user.tag}`);
  void syncDiscordSessionCommands(readyClient)
    .then(() => console.log("Discord session commands synced"))
    .catch((error) => console.error("Discord session command sync failed", error));
  schedulerService.start();
  chatGptQuotaStatusService.start();
});
void client.login(env.discordBotToken);
