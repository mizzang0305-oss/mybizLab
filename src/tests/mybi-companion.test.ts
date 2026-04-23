import {
  buildGuideReply,
  buildMybiConversationIntro,
  buildMybiMailDraft,
  getMybiModeTone,
  normalizeMybiScene,
} from '@/shared/lib/mybiCompanion';

describe('MYBI companion helper', () => {
  const scene = normalizeMybiScene('/onboarding', {
    changedAfterInput: '스토어명과 운영 고민이 반영되었습니다.',
    companionMode: 'listening',
    contextSummary: '공개 유입을 문의와 예약 중심으로 정리하는 중입니다.',
    layoutMode: 'floating',
    nextAction: '입력 채널 우선순위를 결정하세요.',
    planLabel: 'PRO',
    pulseKey: 2,
    routeLabel: '스토어 진단 온보딩',
    selectedHighlights: ['문의', '예약', '고객 기억 축'],
    stepIndex: 2,
    stepLabel: '03 고객 기억 결합',
    storeLabel: '미즈 커피',
    title: '03 고객 기억 결합',
  });

  it('keeps form-heavy scenes compact and quiet by default', () => {
    expect(scene.surfaceMode).toBe('compact');
    expect(scene.quietMode).toBe(true);
  });

  it('builds a Korean-first intro', () => {
    const intro = buildMybiConversationIntro(scene);

    expect(intro).toContain('MYBI');
    expect(intro).toContain('작은 orb 상태');
    expect(intro).toContain('미즈 커피');
  });

  it('answers why-question with memory context', () => {
    const reply = buildGuideReply('왜 이 질문을 하나요?', scene, ['스토어명 입력']);

    expect(reply).toContain('고객 기억 축');
    expect(reply).toContain('입력 하나');
  });

  it('stays quiet and helpful in compact error states', () => {
    const reply = buildGuideReply('오류가 났어요', { ...scene, companionMode: 'alert' }, ['스토어명 입력']);

    expect(reply).toContain('원인을 같이 좁혀볼게요');
    expect(reply).toContain('문제 제보 탭');
  });

  it('builds a reviewed issue mail draft in Korean', () => {
    const draft = buildMybiMailDraft({
      browserErrors: ['ReferenceError: test error'],
      note: '결제 단계로 넘어가기 전에 위치가 잠깐 겹쳤습니다.',
      pathname: '/onboarding',
      recentActivity: ['플랜 선택'],
      reporterEmail: 'tester@example.com',
      sceneState: scene,
      screenshotName: 'mybi.png',
    });

    expect(draft.subject).toContain('문제 제보');
    expect(draft.body).toContain('현재 경로');
    expect(draft.body).toContain('플랜 선택');
    expect(draft.body).toContain('tester@example.com');
    expect(draft.href).toContain('mailto:');
  });

  it('returns Korean state labels', () => {
    expect(getMybiModeTone('listening').label).toBe('듣는 중');
    expect(getMybiModeTone('thinking').label).toBe('생각 중');
    expect(getMybiModeTone('alert').label).toBe('알림');
  });
});
