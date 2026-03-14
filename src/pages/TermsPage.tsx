import { Link } from 'react-router-dom';

import { LegalPageShell, LegalSection } from '@/shared/components/LegalPageShell';
import { usePageMeta } from '@/shared/hooks/usePageMeta';
import { BUSINESS_INFO } from '@/shared/lib/siteConfig';

export function TermsPage() {
  usePageMeta('이용약관', '마이비즈랩 서비스 이용약관과 구독, 결제, 해지, 책임 범위를 확인하세요.');

  return (
    <LegalPageShell
      description="본 약관은 마이비즈랩이 제공하는 SaaS 서비스의 이용 조건, 요금제, 구독, 환불, 책임 범위를 안내합니다."
      eyebrow="Terms"
      title="이용약관"
    >
      <LegalSection title="1. 서비스 정의">
        <p>마이비즈랩은 공개 스토어 페이지, 메뉴/주문 화면, 관리자 대시보드, AI 운영 보조 기능 등을 제공하는 구독형 SaaS 서비스입니다.</p>
      </LegalSection>
      <LegalSection title="2. 회원가입 및 계정">
        <p>회원은 정확한 사업자 및 담당자 정보를 기반으로 계정을 생성하고 관리해야 합니다.</p>
      </LegalSection>
      <LegalSection title="3. 요금제 및 결제">
        <p>
          서비스는 Starter, Pro, Business 요금제로 제공되며 세부 구성은{' '}
          <Link className="font-semibold text-orange-700" to="/pricing">
            요금제 페이지
          </Link>
          에서 안내합니다.
        </p>
      </LegalSection>
      <LegalSection title="4. 구독 및 해지">
        <p>회원은 관리자 페이지 또는 문의 채널을 통해 구독 해지를 요청할 수 있습니다.</p>
      </LegalSection>
      <LegalSection title="5. 환불 기준">
        <p>환불은 결제일, 이용 여부, 제공된 서비스 범위, 관련 법령 및 회사의 환불정책에 따라 검토 후 처리됩니다.</p>
      </LegalSection>
      <LegalSection title="6. 서비스 중단 및 변경">
        <p>시스템 점검, 장애 대응, 기능 개선이 필요한 경우 서비스의 일부 또는 전부를 변경하거나 일시 중단할 수 있습니다.</p>
      </LegalSection>
      <LegalSection title="7. 책임 제한">
        <p>천재지변, 통신 장애, 제3자 인프라 문제 등 회사의 합리적 통제를 벗어난 사유로 발생한 손해는 책임이 제한될 수 있습니다.</p>
      </LegalSection>
      <LegalSection title="8. 문의처">
        <p>
          이메일:{' '}
          <a className="font-semibold text-orange-700" href={`mailto:${BUSINESS_INFO.email}`}>
            {BUSINESS_INFO.email}
          </a>
        </p>
      </LegalSection>
    </LegalPageShell>
  );
}
