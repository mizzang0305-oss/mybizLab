export interface MybiChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface ChatApiResponse {
  ok: boolean;
  reply?: string;
}

interface SendMybiMessageOptions {
  timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 12_000;

function buildLocalFallback(lastMessage: string) {
  const question = lastMessage.toLowerCase();

  if (question.includes('가격') || question.includes('요금') || question.includes('얼마')) {
    return '요금은 매장 운영 방식과 필요한 채널 구성이 달라서, 상담을 통해 가장 맞는 플랜으로 안내드리고 있어요.';
  }

  if (question.includes('qr') || question.includes('주문')) {
    return 'MyBiz는 QR 주문을 단순 주문 도구로 보지 않고, 고객 입력이 고객 기억 축으로 이어지는 채널로 다룹니다.';
  }

  if (question.includes('예약') || question.includes('웨이팅') || question.includes('대기')) {
    return '예약과 웨이팅은 고객이 방문 의도를 남기는 핵심 입력 채널입니다. 이 정보가 쌓여야 다음 운영 액션과 재방문 설계가 더 정확해집니다.';
  }

  if (question.includes('문의') || question.includes('상담')) {
    return '문의는 가장 빠른 관심 신호입니다. 어떤 질문이 반복되는지 쌓이면 후속 응대와 공개 페이지 문구까지 더 정교하게 바꿀 수 있어요.';
  }

  if (question.includes('다음') || question.includes('무엇') || question.includes('어떻게')) {
    return '지금 단계에서는 입력 채널 우선순위와 고객 기억 축에 어떤 정보가 남는지 먼저 확인한 뒤, 다음 액션을 한 가지씩 정하는 방식이 가장 안전합니다.';
  }

  return '지금 화면 맥락 기준으로 도와드릴게요. 질문을 조금만 더 구체적으로 주시면 현재 단계, 다음 액션, 고객 기억 흐름까지 바로 정리해드릴 수 있어요.';
}

export async function sendMybiMessage(
  messages: MybiChatMessage[],
  sceneContext?: string,
  options: SendMybiMessageOptions = {},
): Promise<string> {
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const timeoutId =
    controller && typeof setTimeout === 'function'
      ? setTimeout(() => controller.abort(), timeoutMs)
      : null;

  try {
    const response = await fetch('/api/ai/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages, sceneContext }),
      signal: controller?.signal,
    });

    if (!response.ok) {
      throw new Error(`Chat API returned ${response.status}`);
    }

    const data = (await response.json()) as ChatApiResponse;

    if (data.ok && data.reply?.trim()) {
      return data.reply.trim();
    }

    throw new Error('Empty reply from chat API');
  } catch (error) {
    console.warn('[mybi-chat] API failed, using fallback:', error);
    return buildLocalFallback(messages[messages.length - 1]?.content ?? '');
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}
