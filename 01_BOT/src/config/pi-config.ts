const thinkingLevels = ["off", "minimal", "low", "medium", "high", "xhigh"] as const;
const reasoningEfforts = ["none", "minimal", "low", "medium", "high", "xhigh"] as const;

export type PiThinkingLevel = (typeof thinkingLevels)[number];
export type PiReasoningEffort = (typeof reasoningEfforts)[number];

const normalize = (value: string | undefined) => value?.trim() || undefined;
const isThinkingLevel = (value: string): value is PiThinkingLevel => thinkingLevels.some((option) => option === value);
const isReasoningEffort = (value: string): value is PiReasoningEffort => reasoningEfforts.some((option) => option === value);

export const resolvePiProvider = (env: NodeJS.ProcessEnv) => normalize(env.PI_PROVIDER) || (env.OPENAI_API_KEY ? "openai" : "openai-codex");

export const resolvePiModel = (env: NodeJS.ProcessEnv, provider: string) => {
  const model = normalize(env.PI_MODEL);
  if (model) return model;
  if (provider === "openai" || provider === "openai-codex") return "gpt-5.4";
  throw new Error(`Missing PI_MODEL for provider ${provider}`);
};

export const resolvePiThinkingLevel = (env: NodeJS.ProcessEnv) => {
  const thinking = normalize(env.PI_THINKING_LEVEL);
  if (!thinking) return undefined;
  if (isThinkingLevel(thinking)) return thinking;
  throw new Error(`Invalid PI_THINKING_LEVEL: ${thinking}`);
};

export const resolvePiReasoningEffort = (env: NodeJS.ProcessEnv) => {
  const effort = normalize(env.PI_REASONING_EFFORT);
  if (!effort) return undefined;
  if (isReasoningEffort(effort)) return effort;
  throw new Error(`Invalid PI_REASONING_EFFORT: ${effort}`);
};
