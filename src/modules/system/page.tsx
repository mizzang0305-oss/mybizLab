import { useMemo } from 'react';

import { EmptyState } from '@/shared/components/EmptyState';
import { PageHeader } from '@/shared/components/PageHeader';
import { Panel } from '@/shared/components/Panel';
import { StatusBadge } from '@/shared/components/StatusBadge';
import { useAccessibleStores, useCurrentStore } from '@/shared/hooks/useCurrentStore';
import { usePageMeta } from '@/shared/hooks/usePageMeta';
import {
  APP_RUNTIME_MODE,
  DATA_PROVIDER,
  IS_DEMO_RUNTIME,
  IS_LIVE_RUNTIME,
  PUBLIC_RUNTIME_CONFIG,
  isFirebaseConfigured,
  isSupabaseConfigured,
} from '@/shared/lib/appConfig';

function buildSystemChecks(accessibleStoreCount: number) {
  return [
    {
      description: IS_LIVE_RUNTIME
        ? '브라우저는 live 모드로 동작 중이며, 공개 플로우는 서버 API와 canonical repository를 우선 사용합니다.'
        : '현재는 demo 모드입니다. merchant onboarding 전에는 live 모드 전환이 필요합니다.',
      label: '런타임 모드',
      status: IS_LIVE_RUNTIME ? 'active' : 'warning',
      value: APP_RUNTIME_MODE,
    },
    {
      description: isSupabaseConfigured()
        ? '브라우저에서 Supabase anon 연결값이 확인됩니다.'
        : '브라우저용 Supabase anon 설정이 비어 있습니다.',
      label: 'Supabase 브라우저 연결',
      status: isSupabaseConfigured() ? 'ready' : 'warning',
      value: isSupabaseConfigured() ? 'configured' : 'missing',
    },
    {
      description: PUBLIC_RUNTIME_CONFIG.portone.storeId && PUBLIC_RUNTIME_CONFIG.portone.channelKey
        ? '결제 진입에 필요한 공개 storeId / channelKey가 준비되어 있습니다.'
        : '결제 진입 공개값이 비어 있어 checkout 시작 전 보완이 필요합니다.',
      label: '결제 공개값',
      status: PUBLIC_RUNTIME_CONFIG.portone.storeId && PUBLIC_RUNTIME_CONFIG.portone.channelKey ? 'ready' : 'warning',
      value: PUBLIC_RUNTIME_CONFIG.portone.storeId && PUBLIC_RUNTIME_CONFIG.portone.channelKey ? 'ready' : 'missing',
    },
    {
      description:
        accessibleStoreCount > 0
          ? `${accessibleStoreCount}개 스토어가 현재 접근 컨텍스트에 연결되어 있습니다.`
          : '접근 가능한 스토어가 없어서 운영 화면 대부분이 비어 있을 수 있습니다.',
      label: '스토어 접근 컨텍스트',
      status: accessibleStoreCount > 0 ? 'active' : 'warning',
      value: `${accessibleStoreCount} stores`,
    },
    {
      description:
        isFirebaseConfigured() || DATA_PROVIDER === 'supabase'
          ? '실데이터 공급자 기준으로 동작할 수 있는 설정이 일부 확인됩니다.'
          : 'data provider가 local/demo 성격으로 남아 있을 수 있습니다.',
      label: '데이터 공급자',
      status: DATA_PROVIDER === 'supabase' ? 'active' : DATA_PROVIDER === 'firebase' ? 'ready' : 'warning',
      value: DATA_PROVIDER,
    },
  ];
}

export function SystemPage() {
  const accessibleStoresQuery = useAccessibleStores();
  const { currentStore } = useCurrentStore();

  usePageMeta(
    '시스템 상태',
    '브라우저 런타임, 데이터 공급자, 공개 결제 진입값, 스토어 접근 컨텍스트를 확인하는 운영 페이지입니다.',
  );

  const systemChecks = useMemo(
    () => buildSystemChecks(accessibleStoresQuery.data?.length || 0),
    [accessibleStoresQuery.data?.length],
  );

  if (accessibleStoresQuery.isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader
          eyebrow="System"
          title="런타임 상태를 확인하는 중입니다"
          description="실데이터 연결과 공개 경로 상태를 불러오는 동안 잠시만 기다려 주세요."
        />
      </div>
    );
  }

  if (accessibleStoresQuery.isError) {
    return (
      <EmptyState
        title="시스템 상태를 불러오지 못했습니다"
        description="현재 로그인/스토어 접근 상태 또는 런타임 설정을 확인한 뒤 다시 시도해 주세요."
      />
    );
  }

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="System"
        title="실행 환경 / 연결 상태"
        description="mock 운영 보드 대신, 지금 브라우저에서 실제로 확인 가능한 런타임 조건만 정리한 시스템 상태 화면입니다."
      />

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {systemChecks.map((item) => (
          <div key={item.label} className="section-card p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-900">{item.label}</p>
                <p className="mt-2 text-lg font-bold text-slate-900">{item.value}</p>
              </div>
              <StatusBadge status={item.status} />
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-500">{item.description}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.02fr_0.98fr]">
        <Panel title="경로 / 접근 규칙" subtitle="공개 경로와 보호 경로의 역할을 현재 제품 전략 기준으로 정리했습니다.">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-5">
              <p className="font-semibold text-emerald-950">공개 경로</p>
              <p className="mt-2 text-sm leading-7 text-emerald-900">
                홈, 온보딩, 요금제, 공개 스토어, 문의, 예약, 웨이팅은 merchant acquisition 및 customer-input 채널입니다.
              </p>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
              <p className="font-semibold text-slate-900">운영 경로</p>
              <p className="mt-2 text-sm leading-7 text-slate-700">
                <code>/dashboard</code> 아래는 점주/운영자용 관리 화면입니다. 고객 기억 축과 결제 상태는 이 영역에서 확인합니다.
              </p>
            </div>
          </div>
        </Panel>

        <Panel title="현재 스토어 컨텍스트" subtitle="운영 화면이 무엇을 기준으로 동작하는지 보여줍니다.">
          {currentStore ? (
            <div className="space-y-3">
              <div className="rounded-3xl border border-slate-200 bg-white p-5">
                <p className="text-sm font-semibold text-slate-500">선택된 스토어</p>
                <p className="mt-2 text-2xl font-black text-slate-950">{currentStore.name}</p>
                <p className="mt-2 text-sm text-slate-500">/{currentStore.slug}</p>
              </div>
              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5 text-sm leading-7 text-slate-700">
                <p>
                  현재 스토어는 <span className="font-semibold text-slate-900">{currentStore.business_type || '업종 미설정'}</span>{' '}
                  기준으로 운영되며, 플랜은 <span className="font-semibold text-slate-900">{currentStore.plan || currentStore.subscription_plan || 'free'}</span>
                  입니다.
                </p>
              </div>
            </div>
          ) : (
            <EmptyState
              title="현재 선택된 스토어가 없습니다"
              description="스토어 접근 권한이 연결되면 이 영역에 현재 컨텍스트가 표시됩니다."
            />
          )}
        </Panel>
      </div>

      <Panel title="운영 주의 사항" subtitle="이번 안정화 기준에서 아직 별도 확인이 필요한 영역입니다.">
        <div className="space-y-3">
          <div className="rounded-3xl border border-amber-200 bg-amber-50 p-5 text-sm leading-7 text-amber-900">
            서버 시크릿, 웹훅 비밀키, service role key는 보안상 브라우저에 노출하지 않습니다. 이 화면은 공개 가능한 연결 상태만 보여줍니다.
          </div>
          {IS_DEMO_RUNTIME ? (
            <div className="rounded-3xl border border-amber-200 bg-amber-50 p-5 text-sm leading-7 text-amber-900">
              현재 앱이 demo 모드에 머물러 있습니다. merchant onboarding 전에는 live 모드 전환과 실제 데이터 공급자 확인이 필요합니다.
            </div>
          ) : null}
          {PUBLIC_RUNTIME_CONFIG.warnings.length ? (
            <div className="rounded-3xl border border-rose-200 bg-rose-50 p-5 text-sm leading-7 text-rose-800">
              런타임 경고: {PUBLIC_RUNTIME_CONFIG.warnings.join(' / ')}
            </div>
          ) : null}
        </div>
      </Panel>
    </div>
  );
}
