import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { EmptyState } from '@/shared/components/EmptyState';
import { PageHeader } from '@/shared/components/PageHeader';
import { Panel } from '@/shared/components/Panel';
import { StatusBadge } from '@/shared/components/StatusBadge';
import { formatCurrency } from '@/shared/lib/format';
import { queryKeys } from '@/shared/lib/queryKeys';
import { listCustomers, listOrders, upsertCustomer } from '@/shared/lib/services/mvpService';
import { useCurrentStore } from '@/shared/hooks/useCurrentStore';

const initialForm = {
  id: '',
  name: '',
  phone: '',
  email: '',
  marketing_opt_in: false,
};

export function CustomersPage() {
  const { currentStore } = useCurrentStore();
  const queryClient = useQueryClient();
  const [form, setForm] = useState(initialForm);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>();

  const customersQuery = useQuery({
    queryKey: queryKeys.customers(currentStore?.id || ''),
    queryFn: () => listCustomers(currentStore!.id),
    enabled: Boolean(currentStore),
  });

  const ordersQuery = useQuery({
    queryKey: queryKeys.orders(currentStore?.id || ''),
    queryFn: () => listOrders(currentStore!.id),
    enabled: Boolean(currentStore),
  });

  const customerMutation = useMutation({
    mutationFn: () => upsertCustomer(currentStore!.id, form),
    onSuccess: async () => {
      setForm(initialForm);
      await queryClient.invalidateQueries({ queryKey: queryKeys.customers(currentStore!.id) });
    },
  });

  const selectedCustomer = customersQuery.data?.find((customer) => customer.id === selectedCustomerId) || customersQuery.data?.[0];
  const relatedOrders = useMemo(
    () => ordersQuery.data?.filter((order) => order.customer?.id === selectedCustomer?.id) || [],
    [ordersQuery.data, selectedCustomer?.id],
  );

  if (!currentStore) {
    return null;
  }

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Customer management"
        title="고객 관리"
        description="고객 생성/수정, 방문 횟수, 마지막 방문일, 단골 여부, 마케팅 수신 동의와 주문 이력을 store_id 기준으로 관리합니다."
      />

      <div className="grid gap-8 xl:grid-cols-[1fr_0.8fr]">
        <Panel title="고객 목록" subtitle="주문과 연결된 고객 이력">
          {customersQuery.data?.length ? (
            <div className="space-y-3">
              {customersQuery.data.map((customer) => (
                <button
                  key={customer.id}
                  className={`w-full rounded-3xl border p-4 text-left transition ${selectedCustomer?.id === customer.id ? 'border-orange-300 bg-orange-50' : 'border-slate-200 bg-white'}`}
                  onClick={() => {
                    setSelectedCustomerId(customer.id);
                    setForm({
                      id: customer.id,
                      name: customer.name,
                      phone: customer.phone,
                      email: customer.email || '',
                      marketing_opt_in: customer.marketing_opt_in,
                    });
                  }}
                  type="button"
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-bold text-slate-900">{customer.name}</p>
                      <p className="text-sm text-slate-500">{customer.phone}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      {customer.is_regular ? <StatusBadge status="ready" /> : null}
                      <span className="text-sm font-semibold text-slate-500">{customer.visit_count}회 방문</span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <EmptyState title="고객 데이터가 없습니다" description="주문 후 고객 등록 또는 직접 생성으로 고객 데이터를 쌓을 수 있습니다." />
          )}
        </Panel>

        <div className="space-y-8">
          <Panel title={form.id ? '고객 수정' : '고객 생성'}>
            <div className="grid gap-4">
              <label>
                <span className="field-label">이름</span>
                <input className="input-base" onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} value={form.name} />
              </label>
              <label>
                <span className="field-label">전화번호</span>
                <input className="input-base" onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))} value={form.phone} />
              </label>
              <label>
                <span className="field-label">이메일</span>
                <input className="input-base" onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} value={form.email} />
              </label>
              <label className="flex items-center gap-3 rounded-2xl bg-slate-50 p-4 text-sm font-semibold text-slate-700">
                <input
                  checked={form.marketing_opt_in}
                  className="h-4 w-4 accent-orange-600"
                  onChange={(event) => setForm((current) => ({ ...current, marketing_opt_in: event.target.checked }))}
                  type="checkbox"
                />
                마케팅 수신 동의
              </label>
              <div className="flex gap-3">
                <button className="btn-primary" onClick={() => customerMutation.mutate()} type="button">
                  저장
                </button>
                <button className="btn-secondary" onClick={() => setForm(initialForm)} type="button">
                  초기화
                </button>
              </div>
            </div>
          </Panel>

          <Panel title="주문 이력 연결">
            {selectedCustomer ? (
              <div className="space-y-3">
                {relatedOrders.length ? (
                  relatedOrders.map((order) => (
                    <div key={order.id} className="rounded-3xl border border-slate-200 p-4">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <p className="font-bold text-slate-900">{order.table_no ? `Table ${order.table_no}` : order.channel}</p>
                        <StatusBadge status={order.status} />
                      </div>
                      <p className="mt-2 text-sm text-slate-500">{order.items.map((item) => `${item.menu_name} x${item.quantity}`).join(', ')}</p>
                      <p className="mt-1 text-sm font-semibold text-slate-700">{formatCurrency(order.total_amount)}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-slate-500">아직 연결된 주문 이력이 없습니다.</p>
                )}
              </div>
            ) : (
              <p className="text-sm text-slate-500">고객을 선택하면 주문 이력이 표시됩니다.</p>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}
