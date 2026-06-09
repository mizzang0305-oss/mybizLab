import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it } from 'vitest';

import { LeadCaptureConsolePage } from '@/modules/lead-capture/page';
import { clearLaunchGateOverridesForTest, setLaunchGateOverridesForTest } from '@/shared/lib/launchGates';

describe('lead capture console', () => {
  afterEach(() => {
    clearLaunchGateOverridesForTest();
  });

  it('renders the owner-reviewed lead workflow with disabled risky actions', () => {
    const html = renderToStaticMarkup(createElement(LeadCaptureConsolePage));

    expect(html).toContain('파일럿 리드 관리');
    expect(html).toContain('고객 기억 seed 후보');
    expect(html).toContain('파일럿 상담 후 적용');
    expect(html).toContain('관리자 검토 후 세팅');
    expect(html).toContain('자동 결제/자동 발송은 비활성화됨');
    expect(html).toContain('고객에게 메시지 발송');
    expect(html).toContain('결제 요청');
    expect(html).toContain('DB 저장/실반영');
    expect(html).toContain('disabled=""');
  });

  it('renders an approval-required state when owner review lead capture is off', () => {
    setLaunchGateOverridesForTest({
      ownerReviewedLeadCaptureEnabled: false,
    });

    const html = renderToStaticMarkup(createElement(LeadCaptureConsolePage));

    expect(html).toContain('owner-reviewed lead capture가 비활성화되어 있습니다');
    expect(html).toContain('별도 승인 전까지 리드 콘솔 진입과 상태 변경을 막습니다.');
  });
});
