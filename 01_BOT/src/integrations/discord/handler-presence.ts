import type { IncomingDiscordMessage } from "./handler-message.js";

const TYPING_REFRESH_MS = 5_000;

export const startTypingLoop = (message: IncomingDiscordMessage) => {
  const sendTyping = () => message.channel.sendTyping().catch(() => undefined);
  void sendTyping();
  const timer = setInterval(() => {
    void sendTyping();
  }, TYPING_REFRESH_MS);
  return () => clearInterval(timer);
};
