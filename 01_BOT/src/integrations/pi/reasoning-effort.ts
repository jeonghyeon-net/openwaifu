import type { Model } from "@mariozechner/pi-ai";

import type { PiReasoningEffort } from "../../config/pi-config.js";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const withReasoningInclude = (include: unknown) =>
  Array.isArray(include) && include.includes("reasoning.encrypted_content")
    ? include
    : [...(Array.isArray(include) ? include : []), "reasoning.encrypted_content"];

export const applyReasoningEffort = (payload: unknown, model: Model<any>, effort?: PiReasoningEffort) => {
  if (!effort || !model.reasoning || !isRecord(payload)) return payload;
  if (model.provider !== "openai" && model.provider !== "openai-codex") return payload;
  if ("input" in payload || "instructions" in payload) {
    const reasoning = isRecord(payload.reasoning) ? payload.reasoning : {};
    return {
      ...payload,
      include: withReasoningInclude(payload.include),
      reasoning: { ...reasoning, effort, summary: reasoning.summary ?? "auto" },
    };
  }
  if ("messages" in payload) return { ...payload, reasoning_effort: effort };
  return payload;
};

export const withReasoningEffort = (
  onPayload: ((payload: unknown, model: Model<any>) => Promise<unknown | undefined> | unknown | undefined) | undefined,
  effort?: PiReasoningEffort,
) => {
  if (!effort) return onPayload;
  return async (payload: unknown, model: Model<any>) => {
    const next = await onPayload?.(payload, model);
    return applyReasoningEffort(next ?? payload, model, effort);
  };
};
