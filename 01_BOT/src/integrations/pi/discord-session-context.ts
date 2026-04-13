import type { DiscordToolContext } from "../discord/tools/discord-admin-types.js";

type DiscordSessionContext = {
  scopeId: string;
  discordContext: DiscordToolContext;
};

type DiscordSessionContextState = {
  contexts: Map<string, DiscordSessionContext>;
};

const discordSessionContextSymbol = Symbol.for(
  "openwaifu.discordSessionContextState",
);

const discordSessionContextState = () => {
  const scope = globalThis as typeof globalThis & {
    [discordSessionContextSymbol]?: DiscordSessionContextState;
  };
  scope[discordSessionContextSymbol] ??= { contexts: new Map() };
  return scope[discordSessionContextSymbol];
};

export const registerDiscordSessionContext = (
  sessionFile: string,
  scopeId: string,
  discordContext: DiscordToolContext,
) => {
  discordSessionContextState().contexts.set(sessionFile, {
    scopeId,
    discordContext,
  });
};

export const getDiscordSessionContext = (sessionFile: string) =>
  discordSessionContextState().contexts.get(sessionFile);
