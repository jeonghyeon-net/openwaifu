import type { AgentSession } from "@mariozechner/pi-coding-agent";

import type { DiscordToolContext } from "../discord/tools/discord-admin-types.js";
import { startRuntimePrompt, type ActivePrompt } from "./runtime-prompt.js";
import type { ChatPromptOptions } from "./pi-runtime-types.js";

type StartArgs = {
  repoRoot: string;
  scopeId: string;
  prompt: string;
  options: ChatPromptOptions;
  discordContext: DiscordToolContext;
  activePrompts: Map<string, ActivePrompt>;
  streamControl: { run<T>(scopeId: string, task: () => Promise<T>): Promise<T> };
  getSession(scopeId: string, discordContext: DiscordToolContext): Promise<AgentSession>;
};

export const createRuntimeStream = ({
  repoRoot,
  scopeId,
  prompt,
  options,
  discordContext,
  activePrompts,
  streamControl,
  getSession,
}: StartArgs) => ({
  [Symbol.asyncIterator]: async function* () {
    const started = await streamControl.run(scopeId, () => startRuntimePrompt({
      repoRoot,
      scopeId,
      prompt,
      options,
      discordContext,
      activePrompts,
      getSession,
    }));
    try {
      while (!started.state.isDone() || started.state.chunks.length > 0) {
        if (started.state.chunks.length === 0) await started.state.wait();
        else {
          const chunk = started.state.chunks.shift();
          if (chunk) yield chunk;
        }
      }
      const failure = started.getFailure();
      if (failure && !started.activePrompt.interrupted) throw failure;
    } finally {
      if (!started.state.isDone() && activePrompts.get(scopeId)?.token === started.activePrompt.token) {
        started.activePrompt.interrupted = true;
        await started.activePrompt.session.abort().catch(() => undefined);
      }
      await started.run;
    }
  },
});
