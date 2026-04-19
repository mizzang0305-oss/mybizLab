import { buildGuideReply, type MybiSceneState } from '@/shared/lib/mybiCompanion';

export type MybiApiMessageRole = 'assistant' | 'system' | 'user';
export type MybiConversationMessageRole = 'assistant' | 'user';

export interface MybiApiMessage {
  content: string;
  role: MybiApiMessageRole;
}

export interface MybiConversationMessage {
  content: string;
  createdAt: string;
  id: string;
  role: MybiConversationMessageRole;
}

export interface BuildMybiApiMessagesInput {
  messages: MybiConversationMessage[];
  recentActivity: string[];
  sceneState: MybiSceneState;
  summary?: string | null;
  trimExtra?: number;
  windowSize?: number;
}

export interface CompactMybiConversationResult {
  didSummarize: boolean;
  messages: MybiConversationMessage[];
  summary: string | null;
}

export const MYBI_CHAT_WINDOW_SIZE = 20;
export const MYBI_CONTEXT_RETRY_TRIM = 5;
export const MYBI_SESSION_STORAGE_KEY = 'mybiz_session_id';
export const MYBI_SYSTEM_PROMPT = [
  '당신의 이름은 마이비입니다.',
  '당신은 MyBiz Lab의 AI 운영 도우미이며 한국 소상공인 사장님의 매장 운영을 돕습니다.',
  '항상 한국어로 답하고, 존댓말을 쓰되 딱딱하지 않게 짧고 실용적으로 설명하세요.',
  '제품 범위는 공개 스토어 유입, 문의, 예약, 웨이팅, 고객 기억 축, AI 요약·분류·추천·리포트, 운영 대시보드, QR 주문과 매장 운영 도구입니다.',
  '없는 기능, 확인되지 않은 가격, 미정 정책은 절대 지어내지 말고 "현재 확인되는 정보가 아닙니다" 또는 "상담을 통해 안내드립니다"라고 답하세요.',
  '경쟁사 비교, 법률 자문, 세무 자문은 하지 마세요.',
  '사용자가 영어로 물어도 기본 응답은 한국어로 유지하세요.',
  '답변은 보통 3~6문장 안에서 끝내고, 가능하면 마지막 줄에 다음 행동 한 가지를 제안하세요.',
].join('\n');

export const MYBI_SYSTEM_PROMPT_MESSAGE: MybiApiMessage = {
  content: MYBI_SYSTEM_PROMPT,
  role: 'system',
};

function cleanSnippet(value: string, maxLength = 72) {
  const normalized = value.replace(/\s+/g, ' ').trim();

  if (!normalized) {
    return '';
  }

  return normalized.length > maxLength ? `${normalized.slice(0, maxLength).trimEnd()}...` : normalized;
}

function uniqueSnippets(messages: MybiConversationMessage[], role: MybiConversationMessageRole, limit: number) {
  const snippets = messages
    .filter((message) => message.role === role)
    .map((message) => cleanSnippet(message.content))
    .filter(Boolean);

  return Array.from(new Set(snippets)).slice(-limit);
}

function stripSummaryPrefix(summary: string) {
  return summary.replace(/^이전 대화 요약:\s*/u, '').trim();
}

export function createMybiConversationMessage(
  id: string,
  role: MybiConversationMessageRole,
  content: string,
  createdAt = new Date().toISOString(),
): MybiConversationMessage {
  return {
    content,
    createdAt,
    id,
    role,
  };
}

export function summarizeDroppedMessages(
  droppedMessages: MybiConversationMessage[],
  previousSummary?: string | null,
) {
  const assistantHighlights = uniqueSnippets(droppedMessages, 'assistant', 2);
  const userHighlights = uniqueSnippets(droppedMessages, 'user', 2);
  const sentences: string[] = [];

  if (previousSummary) {
    sentences.push(stripSummaryPrefix(previousSummary));
  }

  if (userHighlights.length) {
    sentences.push(`사용자는 ${userHighlights.join(' / ')} 흐름을 중심으로 질문했습니다.`);
  }

  if (assistantHighlights.length) {
    sentences.push(`마이비는 ${assistantHighlights.join(' / ')} 방향으로 안내했습니다.`);
  }

  if (!sentences.length) {
    return '이전 대화에서는 현재 단계의 의미와 다음 행동을 중심으로 안내가 이어졌습니다.';
  }

  return cleanSnippet(sentences.slice(0, 3).join(' '), 360);
}

export function compactMybiConversationHistory(
  messages: MybiConversationMessage[],
  previousSummary?: string | null,
  keepLast = MYBI_CHAT_WINDOW_SIZE,
): CompactMybiConversationResult {
  if (messages.length <= keepLast) {
    return {
      didSummarize: false,
      messages,
      summary: previousSummary || null,
    };
  }

  const splitIndex = Math.max(0, messages.length - keepLast);
  const droppedMessages = messages.slice(0, splitIndex);
  const recentMessages = messages.slice(splitIndex);

  return {
    didSummarize: true,
    messages: recentMessages,
    summary: summarizeDroppedMessages(droppedMessages, previousSummary),
  };
}

export function trimConversationMessages(messages: MybiConversationMessage[], trimCount = MYBI_CONTEXT_RETRY_TRIM) {
  if (messages.length <= trimCount) {
    return messages;
  }

  return messages.slice(trimCount);
}

export function buildMybiContextSystemMessage(sceneState: MybiSceneState, recentActivity: string[]) {
  const lines = [
    `현재 경로: ${sceneState.routeLabel || '공개 화면'}`,
    `현재 단계: ${sceneState.stepLabel || `${sceneState.stepIndex + 1}단계`}`,
    sceneState.storeLabel ? `대상 매장: ${sceneState.storeLabel}` : null,
    sceneState.planLabel ? `현재 플랜: ${sceneState.planLabel}` : null,
    sceneState.contextSummary ? `상황 요약: ${sceneState.contextSummary}` : null,
    sceneState.meaning ? `이 단계에서 하는 일: ${sceneState.meaning}` : null,
    sceneState.memoryNote ? `고객 기억 축 메모: ${sceneState.memoryNote}` : null,
    sceneState.nextAction ? `권장 다음 행동: ${sceneState.nextAction}` : null,
    sceneState.selectedHighlights?.length
      ? `선택된 핵심 입력: ${sceneState.selectedHighlights.join(', ')}`
      : null,
    recentActivity.length ? `최근 사용자 행동: ${recentActivity.slice(0, 3).join(' | ')}` : null,
    '답변 원칙: 기능을 지어내지 말고, 현재 문맥과 실제 MyBiz 범위 안에서만 답하세요.',
  ].filter(Boolean);

  return lines.join('\n');
}

export function buildMybiApiMessages({
  messages,
  recentActivity,
  sceneState,
  summary,
  trimExtra = 0,
  windowSize = MYBI_CHAT_WINDOW_SIZE,
}: BuildMybiApiMessagesInput) {
  const compacted = compactMybiConversationHistory(messages, summary, windowSize);
  const trimmedMessages = trimExtra > 0 ? trimConversationMessages(compacted.messages, trimExtra) : compacted.messages;
  const apiMessages: MybiApiMessage[] = [MYBI_SYSTEM_PROMPT_MESSAGE];

  if (compacted.summary) {
    apiMessages.push({
      content: `이전 대화 요약: ${stripSummaryPrefix(compacted.summary)}`,
      role: 'system',
    });
  }

  apiMessages.push({
    content: buildMybiContextSystemMessage(sceneState, recentActivity),
    role: 'system',
  });

  apiMessages.push(
    ...trimmedMessages.map((message) => ({
      content: message.content,
      role: message.role,
    })),
  );

  return {
    apiMessages,
    recentMessages: trimmedMessages,
    summary: compacted.summary,
  };
}

export function ensureMybiSystemPrompt(messages: MybiApiMessage[]) {
  if (messages[0]?.role === 'system' && stripSummaryPrefix(messages[0].content) === stripSummaryPrefix(MYBI_SYSTEM_PROMPT)) {
    return messages;
  }

  return [MYBI_SYSTEM_PROMPT_MESSAGE, ...messages];
}

export function trimMybiApiMessages(messages: MybiApiMessage[], trimCount = MYBI_CONTEXT_RETRY_TRIM) {
  const preservedSystemMessages = messages.filter((message) => message.role === 'system');
  const conversationalMessages = messages.filter((message) => message.role !== 'system');
  const trimmedConversation =
    conversationalMessages.length > trimCount ? conversationalMessages.slice(trimCount) : conversationalMessages;

  return [...ensureMybiSystemPrompt(preservedSystemMessages), ...trimmedConversation];
}

export function buildMybiFallbackReply(question: string, sceneState: MybiSceneState, recentActivity: string[]) {
  return buildGuideReply(question, sceneState, recentActivity);
}
