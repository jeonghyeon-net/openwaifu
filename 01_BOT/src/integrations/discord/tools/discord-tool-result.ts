import type { TextContent } from "@mariozechner/pi-ai";

export const discordToolResult = (text: string) => {
  const content: TextContent = { type: "text", text };
  return { content: [content], details: {} };
};
