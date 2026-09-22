/** Pure local serialization. Call after the existing inquiry form validation. */
export interface InquiryHandoffInput {
  companyName: string; systemType: string; currentProblem: string; coreFeatures: readonly string[];
  userScale: string; timeline: string; budget: string; contactName: string;
  email: string; phone: string; reference: string; consent: boolean;
}
export interface InquiryHandoffOptions {
  recipient: string;
  systemLabel: string;
  selectionSummary?: string;
}
export interface InquiryHandoffDraft {
  recipient: string; subject: string; body: string; draftText: string;
  mailtoHref: string | null; recipientOnlyHref: string;
  transferMode: 'prefilled_email' | 'copy_then_email';
  status: 'not_submitted';
}
// A conservative product fallback threshold, NOT a universal mail-client limit.
export const MAILTO_SOFT_LIMIT = 6000;
const crlf = (value: string) => value.replace(/\r\n|\r|\n/g, '\r\n');
const wellFormed = (value: string) => value.replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, '\uFFFD');
const encode = (value: string) => encodeURIComponent(wellFormed(value));

export function buildInquiryHandoff(input: InquiryHandoffInput, options: InquiryHandoffOptions): InquiryHandoffDraft {
  // The recipient comes from the site's existing business configuration, not prospect input.
  if (!/^[A-Za-z0-9.!#$%&'*+\-/=^_`{|}~]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+$/.test(options.recipient)) {
    throw new Error('INQUIRY_RECIPIENT_INVALID');
  }
  if (!input.consent) throw new Error('INQUIRY_CONTACT_CONSENT_REQUIRED');
  const subject = `[MyBizLab 개발 상담] ${input.companyName.replace(/[\r\n\t]+/g, ' ').slice(0, 90)}`;
  // Preserve the full form text. Do not reuse the display-oriented truncated payload.
  const body = crlf([
    'MyBizLab 개발 상담 요청서', '',
    `회사 / 브랜드명: ${input.companyName}`,
    `원하는 제작 유형: ${options.systemLabel || input.systemType}`,
    ...(options.selectionSummary ? [`선택한 서비스 / 모션: ${options.selectionSummary}`] : []),
    `선택한 구성 / 기능: ${input.coreFeatures.length > 0 ? input.coreFeatures.join(' / ') : '(상담 후 결정)'}`,
    `사용자 규모: ${input.userScale}`, `예상 일정: ${input.timeline}`, `예상 예산: ${input.budget}`,
    '', '현재 문제:', input.currentProblem,
    '', `참고 사이트 / 서비스: ${input.reference || '(미입력)'}`,
    '', `담당자명: ${input.contactName}`, `이메일: ${input.email}`, `연락처: ${input.phone}`,
    '', '상담 연락처 처리 안내 확인: 동의', '마케팅 수신 동의: 포함하지 않음',
    '', '이 요청서는 고객이 메일 앱에서 최종 발송해야 전달됩니다. 웹사이트 DB에는 저장하지 않았습니다.',
  ].join('\r\n'));
  const recipientOnlyHref = `mailto:${options.recipient}?subject=${encode(subject)}`;
  const candidate = `${recipientOnlyHref}&body=${encode(body)}`;
  const mailtoHref = candidate.length <= MAILTO_SOFT_LIMIT ? candidate : null;
  return {
    recipient: options.recipient, subject, body,
    draftText: `받는 사람: ${options.recipient}\r\n제목: ${subject}\r\n\r\n${body}`,
    recipientOnlyHref, mailtoHref,
    transferMode: mailtoHref ? 'prefilled_email' : 'copy_then_email',
    status: 'not_submitted',
  };
}
