import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import mybiChatHandler from '../../api/ai/mybi-chat';
import { MYBI_SYSTEM_PROMPT, type MybiApiMessage } from '@/shared/lib/mybiChat';

const sceneState = {
  companionMode: 'listening',
  layoutMode: 'floating',
  pulseKey: 1,
  stepIndex: 2,
};

const baseMessages: MybiApiMessage[] = [
  {
    content: MYBI_SYSTEM_PROMPT,
    role: 'system',
  },
  {
    content: '현재 단계는 고객 기억 결합입니다.',
    role: 'system',
  },
  {
    content: '지금 단계 설명해줘',
    role: 'user',
  },
];

describe('/api/ai/mybi-chat handler', () => {
  const originalApiKey = process.env.OPENAI_API_KEY;
  const originalModel = process.env.OPENAI_MODEL;
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    delete process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_MODEL;
  });

  afterEach(() => {
    process.env.OPENAI_API_KEY = originalApiKey;
    process.env.OPENAI_MODEL = originalModel;
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('returns 405 for GET requests', async () => {
    const response = await mybiChatHandler(
      new Request('https://example.com/api/ai/mybi-chat', {
        method: 'GET',
      }),
    );

    const payload = await response.json();

    expect(response.status).toBe(405);
    expect(payload).toMatchObject({
      code: 'METHOD_NOT_ALLOWED',
      ok: false,
    });
  });

  it('returns 400 for invalid payloads', async () => {
    const response = await mybiChatHandler(
      new Request('https://example.com/api/ai/mybi-chat', {
        body: JSON.stringify({ messages: [] }),
        method: 'POST',
      }),
    );

    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload).toMatchObject({
      code: 'INVALID_CHAT_INPUT',
      ok: false,
    });
  });

  it('returns a Korean fallback reply when OPENAI_API_KEY is missing', async () => {
    const response = await mybiChatHandler(
      new Request('https://example.com/api/ai/mybi-chat', {
        body: JSON.stringify({
          messages: baseMessages,
          question: '왜 이 질문을 하나요?',
          recentActivity: ['플랜 선택'],
          sceneState,
          summary: null,
        }),
        method: 'POST',
      }),
    );

    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      ok: true,
      source: 'fallback',
    });
    expect(typeof payload.reply).toBe('string');
  });

  it('retries once when OpenAI returns context_length_exceeded', async () => {
    process.env.OPENAI_API_KEY = 'sk-test';
    process.env.OPENAI_MODEL = 'gpt-4o-mini';
    globalThis.fetch = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: { code: 'context_length_exceeded', message: 'too long' } }), {
          headers: { 'content-type': 'application/json; charset=utf-8' },
          status: 400,
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: '지금 단계에서는 고객 기억 축이 어떻게 만들어지는지 짧게 확인하시면 됩니다.',
                },
              },
            ],
          }),
          {
            headers: { 'content-type': 'application/json; charset=utf-8' },
            status: 200,
          },
        ),
      ) as typeof fetch;

    const response = await mybiChatHandler(
      new Request('https://example.com/api/ai/mybi-chat', {
        body: JSON.stringify({
          messages: [...baseMessages, ...Array.from({ length: 8 }, (_, index) => ({ content: `추가 메시지 ${index + 1}`, role: index % 2 ? 'assistant' : 'user' }))],
          question: '다음에 무엇을 하면 되나요?',
          recentActivity: ['폼 입력'],
          sceneState,
          summary: '이전 대화 요약: 사용자는 매장 설정과 고객 기억 흐름을 먼저 확인했습니다.',
        }),
        method: 'POST',
      }),
    );

    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      ok: true,
      source: 'openai',
    });
    expect(globalThis.fetch).toHaveBeenCalledTimes(2);
  });
});
