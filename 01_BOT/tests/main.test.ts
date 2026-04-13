import { describe, expect, it } from "vitest";

import {
  baseTask,
  client,
  create,
  createChatGptQuotaStatusService,
  createChatService,
  createDiscordClient,
  createDiscordPresenceService,
  createSchedulerService,
  loadMain,
  registerDiscordHandlers,
  registerDiscordSessionHandlers,
  runtime,
  schedulerServiceArgs,
} from "./main-test-helpers.js";

describe("main wiring", () => {
  it("wires runtime, handlers, and scheduler task execution", async () => {
    await loadMain();
    expect(createDiscordClient).toHaveBeenCalled();
    expect(create).toHaveBeenCalledWith({
      repoRoot: "/repo",
      sessionsRoot: "/sessions",
      extensionsRoot: "/ext",
      skillsRoot: "/skills",
      modelId: "model",
      thinkingLevel: "high",
      discordClient: client,
    });
    expect(createChatService).toHaveBeenCalledWith(runtime);
    expect(createSchedulerService).toHaveBeenCalledWith({ client, tasksFile: "/repo/01_BOT/.data/scheduler/scheduled-tasks.json", runTask: expect.any(Function) });
    expect(createDiscordPresenceService).toHaveBeenCalledWith(client);
    expect(createChatGptQuotaStatusService).toHaveBeenCalledWith({ onStatusText: expect.any(Function), onError: expect.any(Function) });
    expect(registerDiscordHandlers).toHaveBeenCalledWith({ client, chatService: createChatService.mock.results[0]?.value, presenceService: createDiscordPresenceService.mock.results[0]?.value });
    expect(registerDiscordSessionHandlers).toHaveBeenCalledWith({ client, sessionService: runtime });

    const runTask = schedulerServiceArgs()?.runTask;
    if (!runTask) throw new Error("scheduler service args missing");
    await expect(runTask({ ...baseTask, id: "sched-1", scopeId: "scope:1", prompt: "do thing" })).resolves.toBe("scheduled reply");
    await expect(runTask({ ...baseTask, id: "sched-2", scopeId: "scope:2", prompt: "cron task", recurrence: "cron", cron: "0 9 * * *", scheduledTime: undefined })).resolves.toBe("scheduled reply");
    expect(runtime.runScheduledPrompt).toHaveBeenNthCalledWith(1, "scope:1", "sched-1", "do thing", { authorId: "u", channelId: "c", channelName: "general", guildId: "g", guildName: "guild", isDirectMessage: false });
    expect(runtime.runScheduledPrompt).toHaveBeenNthCalledWith(2, "scope:2", "sched-2", "cron task", { authorId: "u", channelId: "c", channelName: "general", guildId: "g", guildName: "guild", isDirectMessage: false });
  });
});
