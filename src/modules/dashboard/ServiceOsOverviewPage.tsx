import { Link } from 'react-router-dom';

import { PageHeader } from '@/shared/components/PageHeader';
import { Panel } from '@/shared/components/Panel';
import { useCurrentStore } from '@/shared/hooks/useCurrentStore';
import { usePageMeta } from '@/shared/hooks/usePageMeta';

const operationalModules = [
  { label: '고객', description: '문의와 고객 이력', href: '/dashboard/customers', status: '사용 가능' },
  { label: '일정', description: '작업·담당자 일정', href: '/dashboard/schedules', status: '선택 모듈' },
  { label: '계약·동의', description: '업무별 계약 상태', href: '/dashboard/contracts', status: '선택 모듈' },
  { label: '증빙·미디어', description: '사진·영상과 파생 자산', href: '/dashboard/content/media', status: '사용 가능' },
] as const;

const growthModules = [
  { label: '브랜드', description: '업체 소개와 브랜드 자산', href: '/dashboard/brand' },
  { label: '콘텐츠 상태', description: '검토·게시 준비 상태', href: '/dashboard/content/status' },
  { label: 'AI 운영 리포트', description: '업무 요약과 실행 제안', href: '/dashboard/ai-reports' },
] as const;

export function ServiceOsOverviewPage() {
  usePageMeta('업무 현황', '고객부터 작업, 증빙, 확인, 기록까지 MyBiz 업무 흐름을 확인합니다.');
  const { currentStore } = useCurrentStore();

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="MYBIZ BUSINESS SERVICE OS"
        title="작업부터 다음 고객까지."
        description={`${currentStore?.name || '현재 업체'}의 고객, 작업, 증빙, 확인, 대금, 기록과 성장 모듈을 한 흐름으로 관리합니다.`}
        actions={<Link className="btn-primary" to="/demo/service-os">Service OS 흐름 보기</Link>}
      />

      <Panel
        title="한 건의 업무 흐름"
        subtitle="현재 화면은 제품 구조를 보여줍니다. 아직 활성화되지 않은 결제·전자서명·외부 게시는 완료된 기능처럼 표시하지 않습니다."
      >
        <ol className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {['고객·문의', '작업·일정', '증빙·고객 확인', '대금·기록·다음 고객'].map((step, index) => (
            <li key={step} className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
              <span className="text-xs font-black text-orange-600">0{index + 1}</span>
              <p className="mt-2 font-black text-slate-950">{step}</p>
            </li>
          ))}
        </ol>
      </Panel>

      <div className="grid gap-5 xl:grid-cols-2">
        <Panel title="운영 Core와 선택 모듈" subtitle="업종에 필요한 항목만 연결합니다.">
          <div className="grid gap-3 sm:grid-cols-2">
            {operationalModules.map((module) => (
              <Link key={module.href} className="rounded-3xl border border-slate-200 bg-white p-5 transition hover:border-orange-300" to={module.href}>
                <div className="flex items-start justify-between gap-3">
                  <p className="font-black text-slate-950">{module.label}</p>
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-600">{module.status}</span>
                </div>
                <p className="mt-2 text-sm leading-6 text-slate-500">{module.description}</p>
              </Link>
            ))}
          </div>
        </Panel>

        <Panel title="기록을 성장 자산으로" subtitle="고객 기억과 콘텐츠는 업무 결과 위에 연결되는 성장 capability입니다.">
          <div className="space-y-3">
            {growthModules.map((module) => (
              <Link key={module.href} className="flex items-center justify-between rounded-3xl border border-slate-200 bg-white p-5 transition hover:border-orange-300" to={module.href}>
                <span>
                  <span className="block font-black text-slate-950">{module.label}</span>
                  <span className="mt-1 block text-sm text-slate-500">{module.description}</span>
                </span>
                <span aria-hidden="true" className="text-orange-600">→</span>
              </Link>
            ))}
          </div>
        </Panel>
      </div>

      <p className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm leading-6 text-amber-900">
        음식점 주문·웨이팅·테이블 주문 기능은 기존 투자 자산으로 보존되며, restaurant vertical이 활성화될 때 사용하는 호환 모듈입니다.
      </p>
    </div>
  );
}
