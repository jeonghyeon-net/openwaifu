import type { AgentSession } from "@mariozechner/pi-coding-agent";

import type { ChatAttachment } from "../../features/chat/chat-attachment.js";
import { prepareChatPrompt } from "../../features/chat/prepare-chat-prompt.js";
import type { DiscordToolContext } from "../discord/tools/discord-admin-types.js";
import { lastAssistantText } from "./last-assistant-text.js";
import { createRuntimeStreamState } from "./runtime-stream-state.js";

export type ActivePrompt = { token: symbol; session: AgentSession; interrupted: boolean };
type PromptOptions = { messageId: string; attachments: ChatAttachment[] };
type StartRuntimePromptOptions = {
  repoRoot: string;
  scopeId: string;
  prompt: string;
  options: PromptOptions;
  discordContext: DiscordToolContext;
  activePrompts: Map<string, ActivePrompt>;
  getSession(scopeId: string, discordContext: DiscordToolContext): Promise<AgentSession>;
};

export const startRuntimePrompt = async ({ repoRoot, scopeId, prompt, options, discordContext, activePrompts, getSession }: StartRuntimePromptOptions) => {
  const token = Symbol(scopeId);
  const session = await getSession(scopeId, discordContext);
  const previous = activePrompts.get(scopeId);
  if (previous) {
    previous.interrupted = true;
    await previous.session.abort().catch(() => undefined);
  }
  const prepared = await prepareChatPrompt({ repoRoot, scopeId, messageId: options.messageId, prompt, attachments: options.attachments });
  const state = createRuntimeStreamState();
  let failure: unknown;
  let streamedText = "";
  const activePrompt: ActivePrompt = { token, session, interrupted: false };
  activePrompts.set(scopeId, activePrompt);
  const unsubscribe = session.subscribe((event) => {
    if (event.type !== "message_update" || event.message.role !== "assistant") return;
    if (event.assistantMessageEvent.type !== "text_delta") return;
    streamedText += event.assistantMessageEvent.delta;
    state.push({ type: "text", text: event.assistantMessageEvent.delta });
  });
  const run = (async () => {
    try {
      await session.prompt(prepared.prompt, prepared.images ? { images: prepared.images } : undefined);
    } catch (error) {
      failure = error;
    } finally {
      unsubscribe();
      if (!activePrompt.interrupted && streamedText.trim() === "") {
        const text = lastAssistantText(session);
        if (text !== "응답 없음") state.push({ type: "text", text });
      }
      if (activePrompts.get(scopeId)?.token === token) activePrompts.delete(scopeId);
      state.finish();
    }
  })();
  return { state, run, activePrompt, getFailure: () => failure };
};
