import {
  MYBI_SYSTEM_PROMPT,
  buildMybiApiMessages,
  compactMybiConversationHistory,
  createMybiConversationMessage,
  trimMybiApiMessages,
} from '@/shared/lib/mybiChat';
import { buildSceneFallback } from '@/shared/lib/mybiCompanion';

describe('mybi chat helpers', () => {
  const sceneState = buildSceneFallback('/onboarding');

  function createHistory(count: number) {
    return Array.from({ length: count }, (_, index) =>
      createMybiConversationMessage(
        `message-${index + 1}`,
        index % 2 === 0 ? 'user' : 'assistant',
        index % 2 === 0 ? `질문 ${index + 1}` : `응답 ${index + 1}`,
        new Date(2026, 3, 19, 9, index).toISOString(),
      ),
    );
  }

  it('always prepends the system prompt and trims the API window to 20 messages', () => {
    const payload = buildMybiApiMessages({
      messages: createHistory(24),
      recentActivity: ['문의 입력', '플랜 검토'],
      sceneState,
    });

    expect(payload.apiMessages[0]).toMatchObject({
      content: MYBI_SYSTEM_PROMPT,
      role: 'system',
    });
    expect(payload.recentMessages).toHaveLength(20);
    expect(payload.apiMessages.some((message) => message.role === 'system' && message.content.startsWith('이전 대화 요약:'))).toBe(true);
  });

  it('summarizes dropped messages when the conversation exceeds the sliding window', () => {
    const compacted = compactMybiConversationHistory(createHistory(26), null, 20);

    expect(compacted.didSummarize).toBe(true);
    expect(compacted.messages).toHaveLength(20);
    expect(compacted.summary).toContain('사용자');
  });

  it('keeps system messages while trimming conversational messages for retries', () => {
    const payload = buildMybiApiMessages({
      messages: createHistory(22),
      recentActivity: ['질문 입력'],
      sceneState,
    });

    const trimmed = trimMybiApiMessages(payload.apiMessages, 5);
    const systemMessageCount = payload.apiMessages.filter((message) => message.role === 'system').length;

    expect(trimmed[0]).toMatchObject({ role: 'system' });
    expect(trimmed.filter((message) => message.role === 'system')).toHaveLength(systemMessageCount);
    expect(trimmed.length).toBe(payload.apiMessages.length - 5);
  });
});
