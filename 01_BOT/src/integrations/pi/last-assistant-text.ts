import type { AgentSession } from "@mariozechner/pi-coding-agent";

import { limitText } from "./format-text.js";

type SessionWithMessages = Pick<AgentSession, "messages">;

export const lastAssistantText = (session: SessionWithMessages) => {
  const last = [...session.messages].reverse().find((message) => message.role === "assistant");
  if (!last || !("content" in last) || !Array.isArray(last.content)) {
    return "응답 없음";
  }

  const text = last.content
    .filter((part) => part.type === "text" && "text" in part)
    .map((part) => part.text)
    .join("\n")
    .trim();

  return text ? limitText(text) : "응답 없음";
};
