/**
 * api/ai/chat.ts
 * 마이비 AI 캐릭터 실제 LLM 응답 엔드포인트
 * - OpenAI gpt-4o-mini 우선, 없으면 Gemini Flash, 없으면 fallback
 */

import { readServerEnv } from '../../src/server/serverEnv.js';

const MYBI_SYSTEM_PROMPT = `당신은 MyBiz(마이비즈랩)의 AI 도우미 "마이비"입니다.

[역할]
- 소상공인 사장님들의 매장 운영을 돕는 친절한 AI 어시스턴트
- MyBiz 플랫폼 안내, 운영 고민 상담, 기능 질문 답변

[성격]
- 따뜻하고 실용적 / 핵심만 간결하게 / 존댓말 사용
- 모르는 것은 솔직하게 인정하고 "확인 후 안내드릴게요" 응답

[MyBiz 주요 기능]
- QR 테이블 주문: 키오스크 없이 QR 코드 하나로 주문 접수
- 예약·대기 관리: 예약 캘린더 + 웨이팅 자동 관리
- 고객 CRM: 방문 이력, 주문 패턴, 고객 기억 자동 축적
- AI 매장 분석: 매출 패턴, 고객 행동 AI 리포트
- 문의 관리: 카카오·전화 문의를 한 곳에서 처리

[요금제]
- FREE: 월 29,000원 (QR 주문, 기본 분석)
- PRO: 월 79,000원 (고객 CRM, 예약, AI 리포트)
- VIP: 월 149,000원 (전체 기능, 멀티 매장)

[금지 사항]
- 가격 외 금전적 약속 금지
- 경쟁사 비교 금지
- 법적·세무 조언 금지
- 존재하지 않는 기능 안내 금지

항상 한국어로 2~4문장 이내로 답변하세요.`;

interface ChatRequestBody {
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  sceneContext?: string;
}

function responseJson(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

async function callOpenAI(messages: ChatRequestBody['messages'], sceneContext?: string) {
  const apiKey = readServerEnv('OPENAI_API_KEY');
  if (!apiKey) return null;

  const model = readServerEnv('OPENAI_MODEL') || 'gpt-4o-mini';

  const systemMessages = [
    { role: 'system' as const, content: MYBI_SYSTEM_PROMPT },
    ...(sceneContext
      ? [{ role: 'system' as const, content: `현재 사용자 화면 컨텍스트: ${sceneContext}` }]
      : []),
  ];

  // 최근 10개 메시지만 전송 (슬라이딩 윈도우)
  const recentMessages = messages.slice(-10);

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: [...systemMessages, ...recentMessages],
      max_tokens: 300,
      temperature: 0.7,
    }),
  });

  if (!res.ok) return null;

  const data = (await res.json()) as {
    choices: Array<{ message: { content: string } }>;
  };

  return data.choices?.[0]?.message?.content?.trim() || null;
}

async function callGemini(messages: ChatRequestBody['messages'], sceneContext?: string) {
  const apiKey = readServerEnv('GEMINI_API_KEY');
  if (!apiKey) return null;

  const recentMessages = messages.slice(-10);

  // Gemini 포맷: user/model 교대
  const geminiContents = recentMessages.map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));

  const systemInstruction = MYBI_SYSTEM_PROMPT + (sceneContext ? `\n\n현재 화면 컨텍스트: ${sceneContext}` : '');

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemInstruction }] },
        contents: geminiContents,
        generationConfig: { maxOutputTokens: 300, temperature: 0.7 },
      }),
    },
  );

  if (!res.ok) return null;

  const data = (await res.json()) as {
    candidates: Array<{ content: { parts: Array<{ text: string }> } }>;
  };

  return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || null;
}

function buildFallbackReply(lastUserMessage: string): string {
  const q = lastUserMessage.toLowerCase();

  if (q.includes('가격') || q.includes('요금') || q.includes('얼마')) {
    return 'FREE 월 29,000원, PRO 월 79,000원, VIP 월 149,000원입니다. 자세한 내용은 요금제 페이지에서 확인하실 수 있어요.';
  }
  if (q.includes('qr') || q.includes('주문')) {
    return 'QR 코드 하나로 테이블 주문을 받을 수 있어요. 키오스크나 별도 기기 없이 고객 스마트폰으로 바로 주문이 가능합니다.';
  }
  if (q.includes('예약') || q.includes('대기')) {
    return '예약 캘린더와 웨이팅 관리를 한 곳에서 처리할 수 있어요. PRO 플랜부터 사용 가능합니다.';
  }
  if (q.includes('고객') || q.includes('crm')) {
    return '방문 이력과 주문 패턴이 자동으로 쌓여 단골 고객을 분석할 수 있어요. PRO 플랜에서 고객 CRM을 사용하실 수 있습니다.';
  }
  if (q.includes('시작') || q.includes('무료') || q.includes('등록')) {
    return '"무료로 시작하기" 버튼을 누르시면 AI 진단 후 매장에 맞는 플랜을 추천받으실 수 있어요.';
  }

  return '궁금하신 점을 조금 더 구체적으로 알려주시면 더 정확하게 안내드릴 수 있어요. AI 진단을 시작하시면 매장 상황에 맞는 추천을 받으실 수 있습니다.';
}

export default async function handler(request: Request) {
  if (request.method !== 'POST') {
    return responseJson({ error: 'Method not allowed' }, 405);
  }

  try {
    const body = (await request.json()) as ChatRequestBody;
    const { messages, sceneContext } = body;

    if (!Array.isArray(messages) || messages.length === 0) {
      return responseJson({ error: 'messages required' }, 400);
    }

    // OpenAI → Gemini → fallback 순서로 시도
    const reply =
      (await callOpenAI(messages, sceneContext)) ??
      (await callGemini(messages, sceneContext)) ??
      buildFallbackReply(messages[messages.length - 1]?.content ?? '');

    return responseJson({ ok: true, reply });
  } catch (error) {
    console.error('[mybi-chat] error:', error);
    return responseJson(
      { ok: true, reply: '잠시 후 다시 시도해주세요. 문의사항은 mybiz.lab3@gmail.com으로 연락주세요.' },
      200,
    );
  }
}
