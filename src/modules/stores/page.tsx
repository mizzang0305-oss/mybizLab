import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';

import { EmptyState } from '@/shared/components/EmptyState';
import { PageHeader } from '@/shared/components/PageHeader';
import { Panel } from '@/shared/components/Panel';
import { StatusBadge } from '@/shared/components/StatusBadge';
import { usePageMeta } from '@/shared/hooks/usePageMeta';
import { formatDateTime } from '@/shared/lib/format';
import {
  PAYMENT_METHOD_STATUS_LABELS,
  STORE_VISIBILITY_LABELS,
  SUBSCRIPTION_PLAN_LABELS,
  SUBSCRIPTION_STATUS_LABELS,
} from '@/shared/lib/platformConsole';
import { queryKeys } from '@/shared/lib/queryKeys';
import { getStoreBrandConfig } from '@/shared/lib/storeData';
import { listPlatformStores } from '@/shared/lib/services/platformConsoleService';

const filters = [
  { key: 'all', label: '전체' },
  { key: 'public', label: '공개중' },
  { key: 'private', label: '비공개' },
  { key: 'billing_pending', label: '결제대기' },
  { key: 'subscription_active', label: '구독활성' },
  { key: 'needs_review', label: '검토필요' },
] as const;

type StoreFilterKey = (typeof filters)[number]['key'];

export function StoresPage() {
  usePageMeta('스토어 관리', '승인된 전체 스토어의 공개 상태, 관리자 이메일, 구독/결제 상태, 내부 기능 접근 상태를 운영 콘솔에서 관리합니다.');

  const [searchParams, setSearchParams] = useSearchParams();
  const activeFilter = (searchParams.get('status') as StoreFilterKey | null) || 'all';
  const keyword = searchParams.get('keyword')?.trim().toLowerCase() || '';

  const storesQuery = useQuery({
    queryKey: queryKeys.platformStores,
    queryFn: listPlatformStores,
  });

  const filteredStores = useMemo(() => {
    return (storesQuery.data || []).filter((item) => {
      const matchesKeyword =
        !keyword ||
        item.store.name.toLowerCase().includes(keyword) ||
        item.store.slug.toLowerCase().includes(keyword) ||
        item.store.admin_email.toLowerCase().includes(keyword);

      if (!matchesKeyword) {
        return false;
      }

      if (activeFilter === 'public') {
        return item.store.public_status === 'public';
      }

      if (activeFilter === 'private') {
        return item.store.public_status === 'private';
      }

      if (activeFilter === 'billing_pending') {
        return item.billingRecord?.setup_status === 'setup_pending' || item.billingRecord?.payment_method_status === 'missing';
      }

      if (activeFilter === 'subscription_active') {
        return item.billingRecord?.subscription_status === 'subscription_active';
      }

      if (activeFilter === 'needs_review') {
        return item.billingRecord?.subscription_status === 'subscription_past_due' || item.billingRecord?.payment_method_status === 'action_required';
      }

      return true;
    });
  }, [activeFilter, keyword, storesQuery.data]);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Store operations"
        title="스토어 관리"
        description="생성된 모든 스토어의 공개 상태, 관리자 이메일, 구독 플랜, 결제 상태와 최근 생성 시점을 운영 관점에서 점검합니다."
      />

      <div className="flex flex-wrap gap-3">
        {filters.map((filter) => (
          <button
            key={filter.key}
            className={[
              'rounded-full px-4 py-2 text-sm font-bold transition',
              activeFilter === filter.key ? 'bg-slate-950 text-white' : 'bg-white text-slate-700 ring-1 ring-slate-200',
            ].join(' ')}
            onClick={() => {
              const next = new URLSearchParams(searchParams);
              if (filter.key === 'all') {
                next.delete('status');
              } else {
                next.set('status', filter.key);
              }
              setSearchParams(next);
            }}
            type="button"
          >
            {filter.label}
          </button>
        ))}
      </div>

      <Panel title="스토어 목록" subtitle="공개 운영 상태와 billing 상태를 함께 보는 플랫폼 운영용 테이블입니다.">
        {filteredStores.length ? (
          <div className="overflow-x-auto">
            <table className="min-w-full border-separate border-spacing-y-3 text-sm">
              <thead>
                <tr className="text-left text-slate-500">
                  <th className="px-4 py-2 font-semibold">스토어명</th>
                  <th className="px-4 py-2 font-semibold">slug</th>
                  <th className="px-4 py-2 font-semibold">업종</th>
                  <th className="px-4 py-2 font-semibold">공개 상태</th>
                  <th className="px-4 py-2 font-semibold">관리자 이메일</th>
                  <th className="px-4 py-2 font-semibold">구독 플랜</th>
                  <th className="px-4 py-2 font-semibold">결제 상태</th>
                  <th className="px-4 py-2 font-semibold">생성일</th>
                  <th className="px-4 py-2 font-semibold">상세 보기</th>
                </tr>
              </thead>
              <tbody>
                {filteredStores.map((item) => (
                  <tr key={item.store.id} className="bg-white shadow-[0_18px_45px_-30px_rgba(15,23,42,0.3)]">
                    <td className="rounded-l-3xl px-4 py-4 align-top">
                      <div className="space-y-1">
                        <p className="font-semibold text-slate-900">{item.store.name}</p>
                        <p className="text-xs text-slate-500">{item.brandProfile?.tagline || item.store.tagline}</p>
                      </div>
                    </td>
                    <td className="px-4 py-4 align-top text-slate-600">/{item.store.slug}</td>
                    <td className="px-4 py-4 align-top text-slate-600">{getStoreBrandConfig(item.store).business_type || '-'}</td>
                    <td className="px-4 py-4 align-top">
                      <div className="space-y-2">
                        <StatusBadge status={item.store.public_status} />
                        <p className="text-xs text-slate-500">{STORE_VISIBILITY_LABELS[item.store.public_status]}</p>
                      </div>
                    </td>
                    <td className="px-4 py-4 align-top text-slate-600">{item.store.admin_email}</td>
                    <td className="px-4 py-4 align-top text-slate-600">{SUBSCRIPTION_PLAN_LABELS[item.billingRecord?.plan || item.store.subscription_plan]}</td>
                    <td className="px-4 py-4 align-top">
                      {item.billingRecord ? (
                        <div className="space-y-2">
                          <StatusBadge status={item.billingRecord.subscription_status} />
                          <p className="text-xs text-slate-500">{SUBSCRIPTION_STATUS_LABELS[item.billingRecord.subscription_status]}</p>
                          <p className="text-xs text-slate-400">{PAYMENT_METHOD_STATUS_LABELS[item.billingRecord.payment_method_status]}</p>
                        </div>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>
                    <td className="px-4 py-4 align-top text-slate-600">{formatDateTime(item.store.created_at)}</td>
                    <td className="rounded-r-3xl px-4 py-4 align-top">
                      <Link className="btn-secondary !px-3 !py-2" to={`/dashboard/stores/${item.store.id}`}>
                        상세 보기
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            title="표시할 스토어가 없습니다"
            description="조건에 맞는 스토어가 아직 없거나 검색 결과가 없습니다. 필터를 바꾸거나 생성 요청을 승인해 주세요."
          />
        )}
      </Panel>
    </div>
  );
}
