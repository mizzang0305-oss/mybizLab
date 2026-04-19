import { ZodError, z } from 'zod';

import {
  buildMybiFallbackReply,
  ensureMybiSystemPrompt,
  trimMybiApiMessages,
  type MybiApiMessage,
} from '../shared/lib/mybiChat.js';

const DEFAULT_OPENAI_MODEL = 'gpt-4o-mini';

const mybiApiMessageSchema = z.object({
  content: z.string().trim().min(1).max(6_000),
  role: z.enum(['assistant', 'system', 'user']),
});

const mybiSceneStateSchema = z
  .object({
    changedAfterInput: z.string().optional(),
    companionMode: z.enum(['alert', 'floating-guide', 'hero', 'listening', 'speaking', 'thinking']),
    contextSummary: z.string().optional(),
    layoutMode: z.enum(['floating', 'hero']),
    meaning: z.string().optional(),
    memoryNote: z.string().optional(),
    nextAction: z.string().optional(),
    planLabel: z.string().optional(),
    pulseKey: z.number(),
    routeLabel: z.string().optional(),
    selectedHighlights: z.array(z.string()).optional(),
    stepIndex: z.number(),
    stepLabel: z.string().optional(),
    storeLabel: z.string().optional(),
    title: z.string().optional(),
  })
  .passthrough();

const mybiChatRequestSchema = z.object({
  messages: z.array(mybiApiMessageSchema).min(1),
  question: z.string().trim().optional(),
  recentActivity: z.array(z.string()).default([]),
  sceneState: mybiSceneStateSchema,
  summary: z.string().nullable().optional(),
});

class MybiChatApiError extends Error {
  code: string;
  status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.code = code;
    this.name = 'MybiChatApiError';
    this.status = status;
  }
}

function responseJson(body: unknown, status = 200) {
  return new Response(JSON.stringify(body, null, 2), {
    headers: {
      'content-type': 'application/json; charset=utf-8',
    },
    status,
  });
}

function parseRequestBody(body: unknown) {
  try {
    return mybiChatRequestSchema.parse(body);
  } catch (error) {
    if (error instanceof ZodError) {
      throw new MybiChatApiError('INVALID_CHAT_INPUT', '유효한 마이비 채팅 요청이 아닙니다.', 400);
    }

    throw error;
  }
}

function extractLatestQuestion(question: string | undefined, messages: MybiApiMessage[]) {
  if (question?.trim()) {
    return question.trim();
  }

  const lastUserMessage = [...messages].reverse().find((message) => message.role === 'user');
  return lastUserMessage?.content.trim() || '';
}

function readChatCompletionText(payload: Record<string, unknown>) {
  const choices = Array.isArray(payload.choices) ? payload.choices : [];
  const firstChoice = choices[0];

  if (!firstChoice || typeof firstChoice !== 'object') {
    return '';
  }

  const message = (firstChoice as Record<string, unknown>).message;
  if (!message || typeof message !== 'object') {
    return '';
  }

  const content = (message as Record<string, unknown>).content;

  if (typeof content === 'string') {
    return content.trim();
  }

  if (!Array.isArray(content)) {
    return '';
  }

  return content
    .map((item) => {
      if (!item || typeof item !== 'object') {
        return '';
      }

      const text = (item as Record<string, unknown>).text;
      return typeof text === 'string' ? text : '';
    })
    .join('\n')
    .trim();
}

function isContextLengthError(status: number, rawBody: string) {
  if (status !== 400) {
    return false;
  }

  return rawBody.includes('context_length_exceeded') || rawBody.includes('maximum context length');
}

async function requestMybiChatCompletion(messages: MybiApiMessage[], retry = true) {
  const apiKey = process.env.OPENAI_API_KEY?.trim();

  if (!apiKey) {
    return null;
  }

  const model = process.env.OPENAI_MODEL?.trim() || DEFAULT_OPENAI_MODEL;
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    body: JSON.stringify({
      messages,
      model,
      temperature: 0.45,
    }),
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    method: 'POST',
  });

  if (!response.ok) {
    const rawBody = await response.text();

    if (retry && isContextLengthError(response.status, rawBody)) {
      const trimmedMessages = trimMybiApiMessages(messages, 5);
      if (trimmedMessages.length < messages.length) {
        return requestMybiChatCompletion(trimmedMessages, false);
      }
    }

    throw new MybiChatApiError(
      isContextLengthError(response.status, rawBody) ? 'CONTEXT_LENGTH_EXCEEDED' : 'OPENAI_CHAT_FAILED',
      '마이비 응답 생성에 실패했습니다.',
      isContextLengthError(response.status, rawBody) ? 400 : 502,
    );
  }

  const payload = (await response.json()) as Record<string, unknown>;
  const text = readChatCompletionText(payload);

  if (!text) {
    throw new MybiChatApiError('EMPTY_CHAT_RESPONSE', '마이비 응답이 비어 있습니다.', 502);
  }

  return text;
}

export async function handleMybiChatRequest(request: Request) {
  if (request.method !== 'POST') {
    return responseJson(
      {
        code: 'METHOD_NOT_ALLOWED',
        ok: false,
        stage: 'method-check',
      },
      405,
    );
  }

  try {
    const rawBody = (await request.json()) as unknown;
    const parsed = parseRequestBody(rawBody);
    const question = extractLatestQuestion(parsed.question, parsed.messages);
    const messages = ensureMybiSystemPrompt(parsed.messages);
    const reply = await requestMybiChatCompletion(messages);

    if (!reply) {
      return responseJson({
        ok: true,
        reply: buildMybiFallbackReply(question, parsed.sceneState, parsed.recentActivity),
        source: 'fallback',
        summary: parsed.summary || null,
      });
    }

    return responseJson({
      ok: true,
      reply,
      source: 'openai',
      summary: parsed.summary || null,
    });
  } catch (error) {
    if (error instanceof MybiChatApiError) {
      if (error.code === 'CONTEXT_LENGTH_EXCEEDED') {
        return responseJson(
          {
            code: error.code,
            ok: false,
          },
          400,
        );
      }

      if (error.status >= 500) {
        return responseJson(
          {
            code: 'TEMPORARY_CHAT_FAILURE',
            ok: false,
          },
          500,
        );
      }

      return responseJson(
        {
          code: error.code,
          ok: false,
        },
        error.status,
      );
    }

    return responseJson(
      {
        code: 'TEMPORARY_CHAT_FAILURE',
        ok: false,
      },
      500,
    );
  }
}
