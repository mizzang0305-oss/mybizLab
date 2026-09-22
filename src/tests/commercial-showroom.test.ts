import {
  ANONYMIZED_SHOWROOM_CASES,
  SHOWROOM_TEMPLATES,
  SYSTEM_STORY,
} from '@/pages/mybiz-field/showroom/showroomData';
import {
  buildDevelopmentInquiryPayload,
  createBrandPreview,
  validateDevelopmentInquiry,
  type DevelopmentInquiryInput,
} from '@/pages/mybiz-field/showroom/showroomState';

const validInquiry: DevelopmentInquiryInput = {
  budget: '견적 상담 후 결정',
  companyName: 'ABC 학원',
  consent: true,
  contactName: '김담당',
  coreFeatures: ['고객관리', '계약 관리'],
  currentProblem: '문의와 계약 진행 상태가 여러 문서에 흩어져 있습니다.',
  email: 'owner@example.com',
  phone: '010-1234-5678',
  reference: '기존 업무 엑셀을 참고하고 싶습니다.',
  systemType: 'crm-workflow',
  timeline: '3개월 이내',
  userScale: '11~30명',
};

describe('commercial showroom product contract', () => {
  it('defines exactly six complete, uniquely identified commercial templates', () => {
    expect(SHOWROOM_TEMPLATES).toHaveLength(6);
    expect(new Set(SHOWROOM_TEMPLATES.map((template) => template.id)).size).toBe(6);

    for (const template of SHOWROOM_TEMPLATES) {
      expect(template.problem.length).toBeGreaterThan(12);
      expect(template.features.length).toBeGreaterThanOrEqual(4);
      expect(template.industries.length).toBeGreaterThanOrEqual(2);
      expect(template.deliveryTime).toBeTruthy();
      expect(template.deliveryMode).toBeTruthy();
      expect(template.maintenance).toBeTruthy();
      expect(template.extensions.length).toBeGreaterThanOrEqual(2);
      expect(template.demoLabel).toBe('직접 체험');
      expect(template.consultationLabel).toBe('이 템플릿으로 상담하기');
      expect(template.demoDisclosure).toMatch(/데모|구성 예시|실제.*실행되지/);
    }
  });

  it('models the complete eight-scene system story without wheel capture', () => {
    expect(SYSTEM_STORY.map((scene) => scene.title)).toEqual([
      '고객 문의',
      '전자계약',
      '결제',
      '업무 자동화',
      '고객관리',
      '콘텐츠 준비',
      '데이터·AI 분석',
      'Owner Control Center',
    ]);
  });

  it('keeps portfolio proof anonymous and free of unsupported metrics', () => {
    const content = JSON.stringify(ANONYMIZED_SHOWROOM_CASES);
    expect(content).not.toMatch(/\+\d+%|-\d+%|실제 고객|도입 기업|매출 \d/);
    for (const item of ANONYMIZED_SHOWROOM_CASES) {
      expect(item).toHaveProperty('problem');
      expect(item).toHaveProperty('system');
      expect(item).toHaveProperty('outcome');
      expect(item.disclosure).toContain('익명');
    }
  });

  it('normalizes the live brand preview and preserves a safe module fallback', () => {
    const preview = createBrandPreview({
      automation: '상담 후 계약서 초안 만들기',
      brandName: `  ABC   학원 ${'가'.repeat(80)}  `,
      industry: '교육',
      primaryColor: 'not-a-color',
      selectedModules: [],
      userCount: '12',
    });

    expect(preview.brandName.length).toBeLessThanOrEqual(40);
    expect(preview.adminTitle).toBe(`${preview.brandName} Admin`);
    expect(preview.primaryColor).toBe('#EC5B13');
    expect(preview.modules).toEqual(['고객관리']);
    expect(preview.userLabel).toBe('12명 사용 예시');
  });

  it('rejects incomplete or invalid inquiry details', () => {
    const errors = validateDevelopmentInquiry({
      ...validInquiry,
      companyName: ' ',
      consent: false,
      coreFeatures: [],
      email: 'invalid',
      phone: '123',
    });

    expect(errors).toMatchObject({
      companyName: expect.any(String),
      consent: expect.any(String),
      coreFeatures: expect.any(String),
      email: expect.any(String),
      phone: expect.any(String),
    });
  });

  it('builds a structured but explicitly non-persisted inquiry payload', () => {
    expect(validateDevelopmentInquiry(validInquiry)).toEqual({});
    const payload = buildDevelopmentInquiryPayload(validInquiry);

    expect(payload).toMatchObject({
      companyName: 'ABC 학원',
      persistenceStatus: 'not_submitted',
      source: 'commercial_showroom',
      systemType: 'crm-workflow',
      version: 1,
    });
    expect(JSON.stringify(payload)).not.toContain('"persistenceStatus":"submitted"');
    expect(JSON.stringify(payload)).not.toMatch(/접수 완료|결제 완료|서명 완료|게시 완료/);
  });

});
