import { useState } from 'react';
import { Link } from 'react-router-dom';

import { createServiceJob, nextContentCandidateState, type ContentCandidateState, type ServiceJob } from '@/domain/mybiz/serviceOs';
import { usePageMeta } from '@/shared/hooks/usePageMeta';
import { DEMO_CONFIRMATION_TOKEN } from './CustomerConfirmationDemoPage';

const initialJob = createServiceJob({ id: 'S-2042', storeId: 'synthetic-store', vertical: 'cleaning', serviceName: '입주청소 · 주방' });

export function ServiceOsDemoPage() {
  const [jobs, setJobs] = useState<ServiceJob[]>([{ ...initialJob, state: 'WORK_COMPLETED' }]);
  const [serviceName, setServiceName] = useState('레이어드 컷');
  const [requiresContract, setRequiresContract] = useState(false);
  const [contentState, setContentState] = useState<ContentCandidateState>('DRAFT');

  usePageMeta('Service OS Demo', '합성 데이터로 작업, 증빙, 고객 확인, 결제 추적과 콘텐츠 후보 흐름을 체험합니다.');
  const current = jobs[0];

  const createDemoJob = () => {
    const job = createServiceJob({ id: `S-${2042 + jobs.length}`, storeId: 'synthetic-store', vertical: 'hair', serviceName: serviceName.trim() || '미용 서비스', requiresContract });
    setJobs((items) => [job, ...items]);
  };

  const advanceContent = () => {
    const action = contentState === 'DRAFT' ? 'generate' : contentState === 'GENERATED' ? 'request_review' : 'approve';
    setContentState((state) => nextContentCandidateState({ current: state, action, publicationEligible: action !== 'approve' ? false : true }));
  };

  return (
    <main className="bg-slate-100 px-4 py-10 text-slate-900 sm:px-8" data-service-os-demo="synthetic">
      <div className="mx-auto max-w-7xl">
        <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">Demo provider · 메모리에서만 동작 · 새로고침 시 초기화 · 실제 업로드/서명/결제/게시 없음</div>
        <header className="mt-8 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div><p className="text-sm font-bold text-orange-700">MyBiz Service OS</p><h1 className="mt-2 text-4xl font-black tracking-[-0.05em] sm:text-6xl">작업 한 건의 운영 화면</h1></div>
          <div className="flex gap-3"><Link className="btn-secondary" to="/">브랜드 홈</Link><Link className="btn-primary" to={`/confirm/${DEMO_CONFIRMATION_TOKEN}`}>고객 확인 화면</Link></div>
        </header>

        <div className="mt-8 grid gap-6 xl:grid-cols-[0.38fr_1fr]">
          <aside className="rounded-3xl border border-slate-200 bg-white p-5">
            <h2 className="text-lg font-black">새 작업 · 합성</h2>
            <label className="mt-5 block"><span className="field-label">서비스명</span><input className="input-base" onChange={(event) => setServiceName(event.target.value)} value={serviceName} /></label>
            <label className="mt-4 flex items-start gap-3 rounded-xl bg-slate-100 p-4 text-sm font-semibold"><input checked={requiresContract} className="mt-1 size-5" onChange={(event) => setRequiresContract(event.target.checked)} type="checkbox" /><span>이 작업은 계약이 필요합니다.<small className="mt-1 block font-normal text-slate-500">기본값은 계약 없음입니다.</small></span></label>
            <button className="btn-primary mt-5 w-full" onClick={createDemoJob} type="button">메모리에 작업 만들기</button>
            <div className="mt-7 space-y-2">{jobs.map((job) => <div className="rounded-xl border border-slate-200 p-3" key={job.id}><div className="flex justify-between text-xs font-bold text-slate-500"><span>#{job.id}</span><span>{job.state}</span></div><p className="mt-2 font-bold">{job.serviceName}</p></div>)}</div>
          </aside>

          <section className="space-y-5">
            <article className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div><p className="text-xs font-bold text-orange-700">JOB #{current.id} · REV {current.evidenceRevision}</p><h2 className="mt-2 text-3xl font-black">{current.serviceName}</h2></div><span className="rounded-full bg-slate-100 px-4 py-2 text-xs font-bold">{current.state}</span></div>
              <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {[
                  ['Contract', current.requiresContract ? current.contractState : '선택 안 함'],
                  ['Evidence', 'metadata ready · object disabled'],
                  ['Customer Confirm', 'secure link demo ready'],
                  ['Payment', current.paymentState],
                  ['Content', contentState],
                  ['Brand Site', 'preview only'],
                ].map(([label, value]) => <div className="rounded-2xl border border-slate-200 p-4" key={label}><p className="text-xs font-bold text-slate-500">{label}</p><p className="mt-2 break-words text-sm font-black">{value}</p></div>)}
              </div>
            </article>

            <div className="grid gap-5 lg:grid-cols-2">
              <article className="rounded-3xl border border-slate-200 bg-white p-6"><h3 className="text-xl font-black">Evidence</h3><p className="mt-2 text-sm leading-7 text-slate-600">원본, thumbnail, content derived object 경계와 metadata 계약은 준비됐습니다. 연결된 Object Storage provider가 없어 업로드 성공을 만들지 않습니다.</p><button className="btn-secondary mt-5 w-full" disabled type="button">Storage provider disabled</button></article>
              <article className="rounded-3xl border border-slate-200 bg-white p-6"><h3 className="text-xl font-black">Content candidate</h3><p className="mt-2 text-sm leading-7 text-slate-600">rule/template 기반 초안은 Review Required까지 진행합니다. PUBLISHED는 provider receipt 없이는 만들지 않습니다.</p><button className="btn-primary mt-5 w-full" disabled={contentState === 'APPROVED'} onClick={advanceContent} type="button">{contentState === 'DRAFT' ? '초안 생성' : contentState === 'GENERATED' ? '검토 요청' : contentState === 'REVIEW_REQUIRED' ? '업체 승인 체험' : 'APPROVED'}</button></article>
            </div>
            <div className="flex flex-wrap gap-3"><Link className="btn-secondary" to="/site/cleaning-studio">승인된 사례 Preview</Link><Link className="btn-secondary" to="/site/hair-studio">동의 없는 빈 상태 Preview</Link></div>
          </section>
        </div>
      </div>
    </main>
  );
}
