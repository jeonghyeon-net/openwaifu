import type { IncomingDiscordMessage, SentDiscordMessage } from "./handler-message.js";

const DISCORD_TEXT_LIMIT = 1900;
const STREAM_FLUSH_INTERVAL_MS = 500;

export const streamDiscordReply = async (
  message: IncomingDiscordMessage,
  stream: AsyncIterable<{ type: "text"; text: string }>,
) => {
  let buffer = "";
  let currentReply: SentDiscordMessage | null = null;
  const flush = async () => {
    if (!buffer.trim()) return;
    if (currentReply) return currentReply.edit(buffer).catch(() => undefined);
    currentReply = (await message.reply(buffer)) ?? null;
  };
  const tick = () => new Promise<"tick">((resolve) => setTimeout(() => resolve("tick"), STREAM_FLUSH_INTERVAL_MS));
  const iterator = stream[Symbol.asyncIterator]();
  let next = iterator.next();
  let timer = tick();
  for (;;) {
    const winner = await Promise.race([
      next.then((result) => ({ type: "chunk" as const, result })),
      timer.then(() => ({ type: "tick" as const })),
    ]);
    if (winner.type === "tick") {
      await flush();
      timer = tick();
      continue;
    }
    if (winner.result.done) break;
    buffer += winner.result.value.text;
    const reply = currentReply as SentDiscordMessage | null;
    if (reply && buffer.length > DISCORD_TEXT_LIMIT) {
      await reply.edit(buffer.slice(0, DISCORD_TEXT_LIMIT)).catch(() => undefined);
      buffer = buffer.slice(DISCORD_TEXT_LIMIT);
      currentReply = null;
    }
    next = iterator.next();
  }
  await flush();
};
