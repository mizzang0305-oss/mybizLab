import { LegalPageShell, LegalSection } from '@/shared/components/LegalPageShell';
import { usePageMeta } from '@/shared/hooks/usePageMeta';
import { BUSINESS_INFO } from '@/shared/lib/siteConfig';

export function RefundPage() {
  usePageMeta('환불정책', '마이비즈랩 구독 서비스의 해지 및 환불 기준을 확인하세요.');

  return (
    <LegalPageShell
      description="마이비즈랩은 구독형 SaaS 서비스 특성을 고려해 해지와 환불 요청을 검토하며, 관련 법령과 약관에 따라 처리합니다."
      eyebrow="Refund"
      title="환불정책"
    >
      <LegalSection title="1. 구독 해지">
        <p>회원은 언제든 구독 해지를 요청할 수 있습니다.</p>
      </LegalSection>
      <LegalSection title="2. 환불 기본 원칙">
        <p>환불은 결제일, 이용 이력, 서비스 제공 여부 및 관련 법령/약관 기준에 따라 검토 후 처리됩니다.</p>
      </LegalSection>
      <LegalSection title="3. 결제 후 7일 이내 환불 검토">
        <p>결제 후 7일 이내이고, 서비스 사용 이력이 없으며 실질적 제공이 없다고 판단되는 경우 환불 가능 여부를 우선 검토합니다.</p>
      </LegalSection>
      <LegalSection title="4. 부분 사용 시 처리 기준">
        <p>서비스를 일부 사용한 경우에는 이용 기간과 제공 기능 범위를 고려하여 일할 정산 또는 정책 기준에 따라 환불 금액이 산정될 수 있습니다.</p>
      </LegalSection>
      <LegalSection title="5. 문의 및 접수">
        <p>
          문의 이메일:{' '}
          <a className="font-semibold text-orange-700" href={`mailto:${BUSINESS_INFO.email}`}>
            {BUSINESS_INFO.email}
          </a>
        </p>
      </LegalSection>
    </LegalPageShell>
  );
}
