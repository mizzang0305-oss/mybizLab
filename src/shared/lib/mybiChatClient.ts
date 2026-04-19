/**
 * mybiChatClient.ts
 * 마이비 AI 채팅 클라이언트
 * - /api/ai/chat 엔드포인트 호출
 * - 실패 시 로컬 fallback
 */

export interface MybiChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface ChatApiResponse {
  ok: boolean;
  reply: string;
}

/**
 * 마이비 AI에게 메시지를 보내고 응답을 받습니다.
 * @param messages 전체 대화 히스토리
 * @param sceneContext 현재 화면 컨텍스트 (선택)
 */
export async function sendMybiMessage(
  messages: MybiChatMessage[],
  sceneContext?: string,
): Promise<string> {
  try {
    const res = await fetch('/api/ai/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages, sceneContext }),
    });

    if (!res.ok) {
      throw new Error(`Chat API returned ${res.status}`);
    }

    const data = (await res.json()) as ChatApiResponse;

    if (data.ok && data.reply) {
      return data.reply;
    }

    throw new Error('Empty reply from chat API');
  } catch (error) {
    console.warn('[mybi-chat] API failed, using fallback:', error);
    return buildLocalFallback(messages[messages.length - 1]?.content ?? '');
  }
}

function buildLocalFallback(lastMessage: string): string {
  const q = lastMessage.toLowerCase();

  if (q.includes('가격') || q.includes('요금') || q.includes('얼마')) {
    return 'FREE 월 29,000원, PRO 월 79,000원, VIP 월 149,000원입니다. 요금제 페이지에서 자세히 확인하실 수 있어요.';
  }
  if (q.includes('qr') || q.includes('주문')) {
    return 'QR 코드 하나로 테이블 주문을 받을 수 있어요. 키오스크 없이 고객 스마트폰으로 바로 주문이 가능합니다.';
  }
  if (q.includes('예약') || q.includes('대기')) {
    return '예약과 웨이팅을 한 곳에서 관리할 수 있어요. PRO 플랜부터 사용 가능합니다.';
  }
  if (q.includes('시작') || q.includes('무료')) {
    return '"무료로 시작하기" 버튼을 눌러 AI 진단을 받아보세요. 매장에 맞는 플랜을 추천해드려요.';
  }

  return '더 자세한 내용은 AI 진단을 시작하시거나, mybiz.lab3@gmail.com으로 문의해주세요.';
}
