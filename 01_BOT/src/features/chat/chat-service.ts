import type { PiRuntime } from "../../integrations/pi/pi-runtime.js";

export type ChatService = {
  run(prompt: string): Promise<string>;
};

export const createChatService = (runtime: PiRuntime): ChatService => ({
  run: (prompt) => runtime.prompt(prompt),
});
