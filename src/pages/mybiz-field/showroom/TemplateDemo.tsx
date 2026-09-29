import { useState, type ReactNode } from 'react';
import { AlertTriangle, ArrowRight, Bot, CircleDot, FileCheck2, PackageCheck, Send, ShieldCheck } from 'lucide-react';

import type { ShowroomTemplateId } from './showroomData';

function DemoShell({ children, disclosure, id }: { children: ReactNode; disclosure: string; id: ShowroomTemplateId }) {
  return (
    <div className="overflow-hidden rounded-[1.4rem] border border-white/12 bg-[#071019] text-white" data-template-demo={id}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 px-4 py-3 text-[10px] font-black tracking-[0.14em] text-white/44">
        <span>INTERACTIVE CONFIGURATION</span>
        <span className="rounded-full bg-[#dfa758]/12 px-2.5 py-1 text-[#f0c98f]">DEMO · NO EXTERNAL WRITE</span>
      </div>
      <div className="p-4 sm:p-6">{children}</div>
      <p className="border-t border-white/10 px-4 py-3 text-[11px] leading-5 text-white/42 sm:px-6">{disclosure}</p>
    </div>
  );
}

function ContractDemo({ disclosure }: { disclosure: string }) {
  const stages = ['범위 초안', '담당자 검토', '서명 준비', '결제 링크 준비'] as const;
  const [stage, setStage] = useState(0);
  return (
    <DemoShell disclosure={disclosure} id="contract-payment">
      <div className="grid gap-3 sm:grid-cols-4">{stages.map((label, index) => <div className={`rounded-xl border p-3 ${index <= stage ? 'border-[#dfa758]/55 bg-[#dfa758]/10' : 'border-white/10 bg-white/[0.03]'}`} key={label}><span className="text-[10px] text-white/38">0{index + 1}</span><strong className="mt-1 block text-xs">{label}</strong></div>)}</div>
      <button className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-full bg-[#ec5b13] px-4 text-xs font-black" data-demo-action="contract-next" onClick={() => setStage((value) => Math.min(value + 1, stages.length - 1))} type="button">다음 검토 단계 <ArrowRight aria-hidden size={15} /></button>
      <p aria-live="polite" className="mt-3 text-xs text-white/55">현재: {stages[stage]} · 실제 서명/결제는 실행하지 않음</p>
    </DemoShell>
  );
}

function ContentDemo({ disclosure }: { disclosure: string }) {
  const [status, setStatus] = useState<'draft' | 'review'>('draft');
  return (
    <DemoShell disclosure={disclosure} id="content-automation">
      <div className="grid gap-3 sm:grid-cols-3">{['Instagram', 'Blog', 'YouTube'].map((channel) => <div className="rounded-xl border border-white/10 bg-white/[0.035] p-4" key={channel}><strong className="text-sm">{channel}</strong><p className="mt-2 text-xs text-white/48">채널별 문구 변환 준비</p><span className="mt-3 inline-flex rounded-full bg-amber-300/10 px-2.5 py-1 text-[10px] font-black text-amber-200">{status === 'draft' ? '발행 준비' : '승인 대기'}</span></div>)}</div>
      <button className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-full bg-[#ec5b13] px-4 text-xs font-black" data-demo-action="content-review" onClick={() => setStatus('review')} type="button"><Send aria-hidden size={15} /> 승인 요청으로 이동</button>
      <p aria-live="polite" className="mt-3 text-xs text-white/55">외부 채널 연동 가능 · 현재 상태: {status === 'draft' ? '발행 준비' : '승인 대기'}</p>
    </DemoShell>
  );
}

function CrmDemo({ disclosure }: { disclosure: string }) {
  const stages = ['신규 문의', '상담', '견적', '계약', '작업', '완료', '사후관리'] as const;
  const [stage, setStage] = useState(0);
  return (
    <DemoShell disclosure={disclosure} id="crm-workflow">
      <div className="flex gap-2 overflow-x-auto pb-2">{stages.map((label, index) => <span className={`min-w-24 rounded-xl border px-3 py-3 text-center text-xs font-bold ${index === stage ? 'border-[#dfa758] bg-[#dfa758] text-[#071019]' : 'border-white/10 text-white/45'}`} key={label}>{label}</span>)}</div>
      <button className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-full bg-[#ec5b13] px-4 text-xs font-black" data-demo-action="crm-next" onClick={() => setStage((value) => (value + 1) % stages.length)} type="button">합성 리드 다음 단계 <ArrowRight aria-hidden size={15} /></button>
      <p aria-live="polite" className="mt-3 text-xs text-white/55">데모 고객 상태: {stages[stage]} · 저장되지 않음</p>
    </DemoShell>
  );
}

function ErpDemo({ disclosure }: { disclosure: string }) {
  const [riskOnly, setRiskOnly] = useState(false);
  const rows = [
    ['SYN-2401', '포장 자재 A', '정상'],
    ['SYN-2402', '원재료 B', '재고 확인'],
    ['SYN-2403', '완제품 C', '출고 준비'],
  ].filter((row) => !riskOnly || row[2] === '재고 확인');
  return (
    <DemoShell disclosure={disclosure} id="erp-wms">
      <div className="overflow-x-auto"><table className="w-full min-w-[28rem] text-left text-xs"><thead className="text-white/38"><tr><th className="pb-3">합성 주문</th><th className="pb-3">품목</th><th className="pb-3">상태</th></tr></thead><tbody>{rows.map((row) => <tr className="border-t border-white/10" key={row[0]}>{row.map((cell) => <td className="py-3" key={cell}>{cell}</td>)}</tr>)}</tbody></table></div>
      <button aria-pressed={riskOnly} className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-full bg-[#ec5b13] px-4 text-xs font-black" data-demo-action="erp-filter" onClick={() => setRiskOnly((value) => !value)} type="button"><AlertTriangle aria-hidden size={15} /> {riskOnly ? '전체 합성 주문 보기' : '재고 확인만 보기'}</button>
      <p aria-live="polite" className="mt-3 text-xs text-white/55">표시 {rows.length}건 · 실제 회사/거래처 데이터 없음</p>
    </DemoShell>
  );
}

function AutomationDemo({ disclosure }: { disclosure: string }) {
  const [processed, setProcessed] = useState(false);
  return (
    <DemoShell disclosure={disclosure} id="api-automation">
      <div className="grid gap-3 sm:grid-cols-3"><div className="rounded-xl border border-white/10 p-4"><CircleDot aria-hidden className="text-[#dfa758]" size={18} /><strong className="mt-3 block text-sm">sample-orders.csv</strong><span className="mt-1 block text-xs text-white/44">합성 입력 24행</span></div><div className="rounded-xl border border-white/10 p-4"><FileCheck2 aria-hidden className={processed ? 'text-emerald-300' : 'text-white/35'} size={18} /><strong className="mt-3 block text-sm">자동 검증</strong><span className="mt-1 block text-xs text-white/44">{processed ? '22행 통과' : '실행 대기'}</span></div><div className="rounded-xl border border-white/10 p-4"><AlertTriangle aria-hidden className={processed ? 'text-amber-200' : 'text-white/35'} size={18} /><strong className="mt-3 block text-sm">예외 검토</strong><span className="mt-1 block text-xs text-white/44">{processed ? '2행 사람 확인' : '실행 대기'}</span></div></div>
      <button className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-full bg-[#ec5b13] px-4 text-xs font-black" data-demo-action="automation-run" onClick={() => setProcessed(true)} type="button"><PackageCheck aria-hidden size={15} /> 합성 파일 검증</button>
      <p aria-live="polite" className="mt-3 text-xs text-white/55">{processed ? '검증 예시 완료 · ERP 전송 없음' : '외부 API 호출 없이 로컬 규칙만 체험합니다.'}</p>
    </DemoShell>
  );
}

function AiAgentDemo({ disclosure }: { disclosure: string }) {
  const [state, setState] = useState<'idle' | 'proposed' | 'approved'>('idle');
  return (
    <DemoShell disclosure={disclosure} id="ai-agent">
      <div className="grid gap-4 rounded-xl border border-white/10 bg-white/[0.035] p-5 sm:grid-cols-[auto_1fr]"><span className="grid size-12 place-items-center rounded-xl bg-[#dfa758] text-[#071019]"><Bot aria-hidden size={22} /></span><div><p className="text-xs font-black text-[#f0c98f]">사전 작성된 운영 제안</p><p className="mt-2 text-sm leading-6 text-white/68">이번 주 미처리 문의를 담당자별로 정리하고, 연락 초안을 준비할 수 있습니다.</p></div></div>
      <div className="mt-5 flex flex-wrap gap-2"><button className="inline-flex min-h-11 items-center gap-2 rounded-full border border-white/20 px-4 text-xs font-black" data-demo-action="agent-propose" onClick={() => setState('proposed')} type="button">제안 검토</button><button className="inline-flex min-h-11 items-center gap-2 rounded-full bg-[#ec5b13] px-4 text-xs font-black disabled:cursor-not-allowed disabled:opacity-40" data-demo-action="agent-approve" disabled={state === 'idle'} onClick={() => setState('approved')} type="button"><ShieldCheck aria-hidden size={15} /> Owner 승인</button></div>
      <p aria-live="polite" className="mt-3 text-xs text-white/55">{state === 'idle' ? '실행 전 제안 확인 필요' : state === 'proposed' ? 'Owner 승인 대기 · 실행 안 함' : '승인됨 · 외부 실행 어댑터는 연결되지 않음'}</p>
    </DemoShell>
  );
}

export function TemplateDemo({ disclosure, templateId }: { disclosure: string; templateId: ShowroomTemplateId }) {
  if (templateId === 'contract-payment') return <ContractDemo disclosure={disclosure} />;
  if (templateId === 'content-automation') return <ContentDemo disclosure={disclosure} />;
  if (templateId === 'crm-workflow') return <CrmDemo disclosure={disclosure} />;
  if (templateId === 'erp-wms') return <ErpDemo disclosure={disclosure} />;
  if (templateId === 'api-automation') return <AutomationDemo disclosure={disclosure} />;
  return <AiAgentDemo disclosure={disclosure} />;
}
