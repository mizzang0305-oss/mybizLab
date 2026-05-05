import { useState } from 'react';
import { Link } from 'react-router-dom';

import { Icons } from '@/shared/components/Icons';
import { usePageMeta } from '@/shared/hooks/usePageMeta';

const readonlyMessage = '데모 화면에서는 저장되지 않습니다. 무료로 시작하면 실제 매장을 관리할 수 있습니다.';

const metrics = [
  { label: '이번 주 고객 기억', value: '128명', note: '재방문 후보 24명' },
  { label: '예약', value: '18건', note: '오늘 확정 6건' },
  { label: '웨이팅', value: '9팀', note: '평균 대기 14분' },
  { label: 'QR 주문', value: '42건', note: '추천 메뉴 포함 17건' },
] as const;

const customers = [
  { name: '김하린', summary: '라떼, 창가석 선호. 최근 3회 방문.', tag: '재방문' },
  { name: '박지훈', summary: '점심 시간 예약 선호. 단체 문의 2회.', tag: '예약' },
  { name: '이서연', summary: '디카페인 요청. 쿠폰 반응 높음.', tag: '추천' },
] as const;

const operations = [
  { channel: '문의', title: '브런치 단체석 문의', status: '답변 대기', time: '10:24' },
  { channel: '예약', title: '4명 창가석 예약', status: '확정', time: '11:30' },
  { channel: '웨이팅', title: '2명 대기 등록', status: '호출 준비', time: '12:08' },
  { channel: 'QR 주문', title: '아메리카노 2, 크루아상 1', status: '제조 중', time: '12:16' },
] as const;

const timeline = [
  '김하린 고객이 라떼를 다시 주문했습니다.',
  '박지훈 고객의 단체 예약 문의가 생성되었습니다.',
  '이서연 고객에게 디카페인 추천 메모가 연결되었습니다.',
  '테이블 7번 주문이 고객 기억에 안전하게 묶였습니다.',
] as const;

export function DemoDashboardPage() {
  const [message, setMessage] = useState(readonlyMessage);

  usePageMeta(
    'MyBiz 운영 대시보드 체험',
    '실제 데이터 없이 MyBiz 점주 화면의 고객 기억, 문의, 예약, 웨이팅, QR 주문 흐름을 둘러봅니다.',
  );

  function handleReadonlyAction() {
    setMessage(readonlyMessage);
  }

  return (
    <main className="page-shell py-12 sm:py-16" data-demo-dashboard="readonly">
      <section className="grid gap-6 lg:grid-cols-[1fr_0.72fr]">
        <div className="section-card p-6 sm:p-8">
          <p className="eyebrow">운영 대시보드 체험</p>
          <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h1 className="font-display text-4xl font-black text-slate-950">서울 단골 커피</h1>
              <p className="mt-3 max-w-2xl break-keep text-sm leading-7 text-slate-600">
                실제 데이터 없이 고객 기억 기반 MyBiz 점주 화면을 둘러보는 읽기 전용 샘플입니다.
                문의, AI 상담, 예약, 웨이팅, QR 주문이 한 고객 타임라인으로 이어지는 흐름을 확인할 수 있습니다.
              </p>
            </div>
            <Link className="btn-primary shrink-0" to="/onboarding?plan=free">
              무료로 시작하기
            </Link>
          </div>
        </div>

        <aside className="section-card border-orange-200 bg-orange-50 p-6">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-orange-700">
              <Icons.ShieldCheck size={20} />
            </div>
            <div>
              <h2 className="text-base font-black text-slate-950">읽기 전용 데모</h2>
              <p className="mt-2 break-keep text-sm leading-6 text-slate-700">{message}</p>
            </div>
          </div>
        </aside>
      </section>

      <section className="mt-6 grid gap-4 md:grid-cols-4">
        {metrics.map((metric) => (
          <article key={metric.label} className="section-card p-5">
            <p className="text-xs font-bold text-slate-500">{metric.label}</p>
            <p className="mt-2 font-display text-3xl font-black text-slate-950">{metric.value}</p>
            <p className="mt-1 text-sm text-slate-600">{metric.note}</p>
          </article>
        ))}
      </section>

      <section className="mt-6 grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
        <div className="section-card p-6">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-display text-2xl font-black text-slate-950">고객 기억</h2>
            <button className="btn-secondary !px-3 !py-2" onClick={handleReadonlyAction} type="button">
              메모 저장
            </button>
          </div>
          <div className="mt-5 space-y-3">
            {customers.map((customer) => (
              <article key={customer.name} className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="font-black text-slate-950">{customer.name}</h3>
                  <span className="rounded-full bg-orange-50 px-3 py-1 text-xs font-bold text-orange-700">{customer.tag}</span>
                </div>
                <p className="mt-2 text-sm leading-6 text-slate-600">{customer.summary}</p>
              </article>
            ))}
          </div>
        </div>

        <div className="section-card p-6">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-display text-2xl font-black text-slate-950">오늘의 운영</h2>
            <button className="btn-secondary !px-3 !py-2" onClick={handleReadonlyAction} type="button">
              상태 변경
            </button>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {operations.map((item) => (
              <article key={`${item.channel}-${item.time}`} className="rounded-2xl border border-slate-200 bg-white p-4">
                <p className="text-xs font-black text-orange-600">{item.channel}</p>
                <h3 className="mt-2 font-black text-slate-950">{item.title}</h3>
                <p className="mt-2 text-sm text-slate-600">{item.status} · {item.time}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="mt-6 section-card p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="eyebrow">Customer timeline</p>
            <h2 className="mt-2 font-display text-2xl font-black text-slate-950">고객 타임라인</h2>
          </div>
          <button className="btn-secondary self-start" onClick={handleReadonlyAction} type="button">
            후속 액션 만들기
          </button>
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          {timeline.map((item, index) => (
            <article key={item} className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-xs font-bold text-slate-500">{String(index + 1).padStart(2, '0')}</p>
              <p className="mt-2 text-sm leading-6 text-slate-700">{item}</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
