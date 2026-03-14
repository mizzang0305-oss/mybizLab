import { LegalPageShell, LegalSection } from '@/shared/components/LegalPageShell';
import { usePageMeta } from '@/shared/hooks/usePageMeta';
import { BUSINESS_INFO } from '@/shared/lib/siteConfig';

export function PrivacyPage() {
  usePageMeta('개인정보처리방침', '마이비즈랩의 개인정보 수집 항목, 목적, 보관 기간, 이용자 권리를 확인하세요.');

  return (
    <LegalPageShell
      description="마이비즈랩은 서비스 제공에 필요한 최소한의 개인정보만 수집하며 관련 법령에 따라 안전하게 관리합니다."
      eyebrow="Privacy"
      title="개인정보처리방침"
    >
      <LegalSection title="1. 수집 항목">
        <p>이름, 이메일, 사업자 정보, 서비스 이용 기록, 결제 관련 정보, 문의 접수 내용을 수집할 수 있습니다.</p>
      </LegalSection>
      <LegalSection title="2. 수집 목적">
        <p>회원 식별, 계정 관리, 서비스 제공, 결제 및 환불 처리, 문의 대응, 서비스 개선을 위해 사용됩니다.</p>
      </LegalSection>
      <LegalSection title="3. 보관 기간">
        <p>수집 목적이 달성되면 지체 없이 파기하며, 관련 법령상 보관 의무가 있는 정보는 해당 기간 동안 별도 보관합니다.</p>
      </LegalSection>
      <LegalSection title="4. 제3자 제공 여부">
        <p>원칙적으로 이용자의 개인정보를 외부에 제공하지 않으며, 법령상 의무 또는 이용자 동의가 있는 경우에만 예외적으로 제공합니다.</p>
      </LegalSection>
      <LegalSection title="5. 처리 위탁 가능성">
        <p>이메일 발송, 결제 처리, 고객 지원 등 일부 업무는 전문 업체에 위탁될 수 있습니다.</p>
      </LegalSection>
      <LegalSection title="6. 이용자 권리">
        <p>이용자는 개인정보 열람, 정정, 삭제, 처리정지 요청을 할 수 있습니다.</p>
      </LegalSection>
      <LegalSection title="7. 문의">
        <p>고객센터: {BUSINESS_INFO.customerCenter}</p>
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
