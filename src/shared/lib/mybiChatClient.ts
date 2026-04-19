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
  const q = lastMessage.toLowerCase();

  if (q.includes('가격') || q.includes('요금') || q.includes('얼마')) {
    return '요금은 스토어 운영 방식과 필요한 기능에 따라 달라져서, 상담을 통해 가장 맞는 플랜으로 안내드리고 있어요.';
  }

  if (q.includes('qr') || q.includes('주문')) {
    return 'MYBI는 QR 주문 흐름과 운영 데이터를 함께 보면서, 주문이 고객 기억으로 이어지도록 돕는 쪽에 강점이 있어요.';
  }

  if (q.includes('예약') || q.includes('웨이팅') || q.includes('대기')) {
    return '예약과 웨이팅은 단순 접수가 아니라 고객 입력 채널이에요. 누가 언제 왜 들어왔는지가 쌓여야 다음 운영 액션이 더 정확해집니다.';
  }

  if (q.includes('문의') || q.includes('상담')) {
    return '문의는 가장 빠른 고객 의도 신호예요. 어떤 질문이 반복되는지 쌓이면, 응대 문구와 다음 제안까지 훨씬 선명해집니다.';
  }

  if (q.includes('다음') || q.includes('무엇') || q.includes('어떻게')) {
    return '지금 단계에서는 입력된 정보가 고객 기억 축으로 어떻게 이어지는지 먼저 확인하고, 그다음 액션 하나만 선명하게 정하는 쪽이 좋습니다.';
  }

  return '지금 화면 맥락 기준으로 답해드릴게요. 질문을 조금만 더 구체적으로 주시면 단계 의미, 다음 액션, 고객 기억 흐름까지 바로 정리해드릴 수 있어요.';
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
    const res = await fetch('/api/ai/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages, sceneContext }),
      signal: controller?.signal,
    });

    if (!res.ok) {
      throw new Error(`Chat API returned ${res.status}`);
    }

    const data = (await res.json()) as ChatApiResponse;

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
