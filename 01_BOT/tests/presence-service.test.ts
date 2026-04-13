import { ActivityType } from "discord.js";
import { describe, expect, it, vi } from "vitest";

import { createDiscordPresenceService } from "../src/integrations/discord/presence-service.js";

describe("presence service", () => {
  it("syncs busy state and custom status", () => {
    const setPresence = vi.fn();
    const service = createDiscordPresenceService({ user: { setPresence } });

    service.setCustomStatus("5h 35% used · Weekly 62% used");
    service.setBusy(1);
    service.setBusy(0);

    expect(setPresence).toHaveBeenNthCalledWith(1, {
      status: "online",
      activities: [{ name: "5h 35% used · Weekly 62% used", state: "5h 35% used · Weekly 62% used", type: ActivityType.Custom }],
    });
    expect(setPresence).toHaveBeenNthCalledWith(2, {
      status: "dnd",
      activities: [{ name: "5h 35% used · Weekly 62% used", state: "5h 35% used · Weekly 62% used", type: ActivityType.Custom }],
    });
    expect(setPresence).toHaveBeenNthCalledWith(3, {
      status: "online",
      activities: [{ name: "5h 35% used · Weekly 62% used", state: "5h 35% used · Weekly 62% used", type: ActivityType.Custom }],
    });
  });

  it("clears custom status and tolerates missing client user", () => {
    const setPresence = vi.fn();
    const service = createDiscordPresenceService({ user: { setPresence } });
    const missingUserService = createDiscordPresenceService({ user: null });

    service.setCustomStatus("busy");
    service.setCustomStatus("   ");
    missingUserService.setBusy(1);
    missingUserService.setCustomStatus("ignored");

    expect(setPresence).toHaveBeenNthCalledWith(1, {
      status: "online",
      activities: [{ name: "busy", state: "busy", type: ActivityType.Custom }],
    });
    expect(setPresence).toHaveBeenNthCalledWith(2, { status: "online", activities: [] });
  });
});
