import { MessageFlags } from "discord.js";

import type { ScopeSessionStats } from "../pi/session-stats.js";

const numberFormat = new Intl.NumberFormat("ko-KR");
const scopeLabel = (isDirectMessage: boolean) =>
  isDirectMessage ? "현재 DM 세션" : "현재 채널에서 내 세션";
const formatTokenCount = (value: number) => numberFormat.format(value);

export const sessionReply = (content: string, guildId: string | null) =>
  guildId ? { content, flags: MessageFlags.Ephemeral } : { content };

export const formatResetMessage = (isDirectMessage: boolean) =>
  isDirectMessage
    ? "현재 DM 세션 초기화 완료. 다음 메시지부터 새 세션 시작."
    : "현재 채널에서 내 세션 초기화 완료. 다음 메시지부터 새 세션 시작.";

export const formatSessionUsage = (
  stats: ScopeSessionStats | undefined,
  isDirectMessage: boolean,
) => {
  const label = scopeLabel(isDirectMessage);
  if (!stats) return `${label} 기록 없음. 아직 누적 토큰 없음.`;

  return [
    `${label} 사용량`,
    `메시지: user ${stats.userMessages}, assistant ${stats.assistantMessages}, toolResult ${stats.toolResults}`,
    `도구 호출: ${stats.toolCalls}`,
    `누적 토큰: input ${formatTokenCount(stats.tokens.input)}, output ${formatTokenCount(stats.tokens.output)}, cache read ${formatTokenCount(stats.tokens.cacheRead)}, cache write ${formatTokenCount(stats.tokens.cacheWrite)}, total ${formatTokenCount(stats.tokens.total)}`,
    `누적 비용: $${stats.cost.toFixed(3)}`,
  ].join("\n");
};
