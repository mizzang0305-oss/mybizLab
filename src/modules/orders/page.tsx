import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { PageHeader } from '@/shared/components/PageHeader';
import { Panel } from '@/shared/components/Panel';
import { StatusBadge } from '@/shared/components/StatusBadge';
import { formatCurrency, formatDateTime } from '@/shared/lib/format';
import { queryKeys } from '@/shared/lib/queryKeys';
import { listOrders, updateOrderStatus } from '@/shared/lib/services/mvpService';
import { useCurrentStore } from '@/shared/hooks/useCurrentStore';
import type { OrderStatus } from '@/shared/types/models';

export function OrdersPage() {
  const { currentStore } = useCurrentStore();
  const queryClient = useQueryClient();
  const [selectedOrderId, setSelectedOrderId] = useState<string>();

  const ordersQuery = useQuery({
    queryKey: queryKeys.orders(currentStore?.id || ''),
    queryFn: () => listOrders(currentStore!.id),
    enabled: Boolean(currentStore),
  });

  const statusMutation = useMutation({
    mutationFn: ({ orderId, status }: { orderId: string; status: OrderStatus }) =>
      updateOrderStatus(currentStore!.id, orderId, status),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.orders(currentStore!.id) });
      await queryClient.invalidateQueries({ queryKey: queryKeys.sales(currentStore!.id) });
      await queryClient.invalidateQueries({ queryKey: queryKeys.kitchen(currentStore!.id) });
    },
  });

  const selectedOrder = ordersQuery.data?.find((order) => order.id === selectedOrderId) || ordersQuery.data?.[0];

  if (!currentStore) {
    return null;
  }

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Order management"
        title="주문 관리"
        description="주문 목록, 상태 변경, 주문 상세 보기, 테이블 번호/채널/금액을 store_id 기준으로 관리합니다."
      />

      <div className="grid gap-8 xl:grid-cols-[1fr_0.75fr]">
        <Panel title="주문 목록">
          <div className="space-y-3">
            {ordersQuery.data?.map((order) => (
              <button
                key={order.id}
                className={`w-full rounded-3xl border p-4 text-left transition ${selectedOrder?.id === order.id ? 'border-orange-300 bg-orange-50' : 'border-slate-200 bg-white'}`}
                onClick={() => setSelectedOrderId(order.id)}
                type="button"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-bold text-slate-900">
                      {order.table_no ? `Table ${order.table_no}` : order.channel} · {formatCurrency(order.total_amount)}
                    </p>
                    <p className="mt-1 text-sm text-slate-500">{formatDateTime(order.placed_at)}</p>
                    <p className="mt-1 text-sm text-slate-500">{order.items.map((item) => `${item.menu_name} x${item.quantity}`).join(', ')}</p>
                  </div>
                  <StatusBadge status={order.status} />
                </div>
              </button>
            ))}
          </div>
        </Panel>

        <Panel title="주문 상세">
          {selectedOrder ? (
            <div className="space-y-4">
              <div className="rounded-3xl bg-slate-50 p-4">
                <p className="text-sm text-slate-500">채널</p>
                <p className="font-bold text-slate-900">{selectedOrder.table_no ? `Table ${selectedOrder.table_no}` : selectedOrder.channel}</p>
                <p className="mt-2 text-sm text-slate-500">고객</p>
                <p className="font-semibold text-slate-700">{selectedOrder.customer?.name || '미등록 고객'}</p>
              </div>
              <div className="rounded-3xl border border-slate-200 p-4">
                {selectedOrder.items.map((item) => (
                  <div key={item.id} className="flex items-center justify-between py-2 text-sm">
                    <span>{item.menu_name} x{item.quantity}</span>
                    <span className="font-semibold">{formatCurrency(item.line_total)}</span>
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                {(['pending', 'accepted', 'preparing', 'ready', 'completed', 'cancelled'] as OrderStatus[]).map((status) => (
                  <button
                    key={status}
                    className="btn-secondary"
                    onClick={() => statusMutation.mutate({ orderId: selectedOrder.id, status })}
                    type="button"
                  >
                    {status}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </Panel>
      </div>
    </div>
  );
}
