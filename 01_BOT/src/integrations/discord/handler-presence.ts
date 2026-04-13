import type { DiscordEventClient, IncomingDiscordMessage } from "./handler-message.js";

const TYPING_REFRESH_MS = 5_000;

export const setBusyPresence = (client: DiscordEventClient, activeResponses: number) => {
  client.user?.setPresence({ status: activeResponses > 0 ? "dnd" : "online" });
};

export const startTypingLoop = (message: IncomingDiscordMessage) => {
  const sendTyping = () => message.channel.sendTyping().catch(() => undefined);
  void sendTyping();
  const timer = setInterval(() => {
    void sendTyping();
  }, TYPING_REFRESH_MS);
  return () => clearInterval(timer);
};
