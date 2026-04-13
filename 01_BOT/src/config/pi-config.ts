const thinkingLevels = ["off", "minimal", "low", "medium", "high", "xhigh"] as const;

export const fixedPiProvider = "openai-codex" as const;

export type PiProvider = typeof fixedPiProvider;
export type PiThinkingLevel = (typeof thinkingLevels)[number];

const normalize = (value: string | undefined) => value?.trim() || undefined;
const isThinkingLevel = (value: string): value is PiThinkingLevel => thinkingLevels.some((option) => option === value);

export const resolvePiModel = (env: NodeJS.ProcessEnv) => normalize(env.PI_MODEL) || "gpt-5.4";

export const resolvePiThinkingLevel = (env: NodeJS.ProcessEnv) => {
  const thinking = normalize(env.PI_THINKING_LEVEL);
  if (!thinking) return undefined;
  if (isThinkingLevel(thinking)) return thinking;
  throw new Error(`Invalid PI_THINKING_LEVEL: ${thinking}`);
};
