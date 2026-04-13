import { ActivityType } from "discord.js";

export type DiscordPresenceClient = {
  user?: {
    setPresence(args: {
      status: "dnd" | "online";
      activities?: Array<{
        name: string;
        state?: string;
        type: ActivityType;
      }>;
    }): unknown;
  } | null;
};

export type DiscordPresenceService = {
  setBusy(activeResponses: number): void;
  setCustomStatus(text: string | null | undefined): void;
};

export const createDiscordPresenceService = (client: DiscordPresenceClient): DiscordPresenceService => {
  let busy = false;
  let customStatusText: string | null = null;

  const syncPresence = () => {
    client.user?.setPresence({
      status: busy ? "dnd" : "online",
      activities: customStatusText
        ? [{ name: customStatusText, state: customStatusText, type: ActivityType.Custom }]
        : [],
    });
  };

  return {
    setBusy(activeResponses) {
      busy = activeResponses > 0;
      syncPresence();
    },
    setCustomStatus(text) {
      customStatusText = text?.trim() || null;
      syncPresence();
    },
  };
};
