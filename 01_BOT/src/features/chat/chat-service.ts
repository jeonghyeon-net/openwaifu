import type { PiRuntime } from "../../integrations/pi/pi-runtime.js";

export type ChatService = {
  reply(scopeId: string, prompt: string): Promise<string>;
};

export const createChatService = (runtime: PiRuntime): ChatService => ({
  reply: (scopeId, prompt) => runtime.prompt(scopeId, prompt),
});
