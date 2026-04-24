import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { PageHeader } from '@/shared/components/PageHeader';
import { Panel } from '@/shared/components/Panel';
import { StatusBadge } from '@/shared/components/StatusBadge';
import { useCurrentStore } from '@/shared/hooks/useCurrentStore';
import { getCustomerDisplayLabel } from '@/shared/lib/customerDisplay';
import { formatCurrency, formatDateTime } from '@/shared/lib/format';
import { queryKeys } from '@/shared/lib/queryKeys';
import { listOrders, recordOrderPayment, updateOrderStatus } from '@/shared/lib/services/mvpService';
import type { OrderPaymentMethod, OrderPaymentSource, OrderStatus } from '@/shared/types/models';

const orderChannelLabelMap: Record<string, string> = {
  delivery: '배달',
  pickup: '포장',
  reservation: '예약 주문',
  table: '테이블 주문',
  table_order: '테이블 주문',
  walk_in: '매장 방문',
};

const orderStatusLabelMap: Record<OrderStatus, string> = {
  pending: '접수 대기',
  accepted: '접수 완료',
  preparing: '준비중',
  ready: '준비 완료',
  completed: '완료',
  cancelled: '취소',
};

const paymentSourceLabelMap: Record<OrderPaymentSource, string> = {
  counter: '카운터 결제',
  mobile: '모바일 결제',
};

const paymentMethodLabelMap: Record<OrderPaymentMethod, string> = {
  card: '카드',
  cash: '현금',
  other: '기타',
};

function getOrderChannelLabel(channel: string) {
  return orderChannelLabelMap[channel] || channel;
}

function getPaymentSourceLabel(source?: OrderPaymentSource) {
  return source ? paymentSourceLabelMap[source] : '결제 방식 미확정';
}

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

  const paymentMutation = useMutation({
    mutationFn: ({
      orderId,
      paymentMethod,
      paymentSource,
    }: {
      orderId: string;
      paymentMethod?: OrderPaymentMethod;
      paymentSource: OrderPaymentSource;
    }) => recordOrderPayment(currentStore!.id, orderId, { paymentMethod, paymentSource }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.orders(currentStore!.id) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.sales(currentStore!.id) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.tableLiveBoard(currentStore!.id) }),
      ]);
    },
  });

  const selectedOrder = ordersQuery.data?.find((order) => order.id === selectedOrderId) || ordersQuery.data?.[0];
  const selectedCustomerLabel = selectedOrder
    ? getCustomerDisplayLabel({
        customer: selectedOrder.customer,
        customerId: selectedOrder.customer_id,
      })
    : null;

  if (!currentStore) {
    return null;
  }

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="주문 현황"
        title="주문 관리"
        description="주문, 테이블, 결제 구분, 고객 기억 연결 상태를 한 화면에서 확인하고 처리합니다."
      />

      <div className="grid gap-8 xl:grid-cols-[1fr_0.75fr]">
        <Panel title="주문 목록">
          <div className="space-y-3">
            {ordersQuery.data?.map((order) => {
              const customerLabel = getCustomerDisplayLabel({
                customer: order.customer,
                customerId: order.customer_id,
              });

              return (
                <button
                  key={order.id}
                  className={`w-full rounded-3xl border p-4 text-left transition ${selectedOrder?.id === order.id ? 'border-orange-300 bg-orange-50' : 'border-slate-200 bg-white'}`}
                  onClick={() => setSelectedOrderId(order.id)}
                  type="button"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-bold text-slate-900">
                        주문번호 {order.id.slice(-6)} · {order.table_no ? `테이블 ${order.table_no}` : getOrderChannelLabel(order.channel)}
                      </p>
                      <p className="mt-1 text-sm text-slate-500">
                        {formatDateTime(order.placed_at)} · {formatCurrency(order.total_amount)}
                      </p>
                      <p className="mt-1 text-sm font-semibold text-slate-700">
                        {customerLabel} · {getPaymentSourceLabel(order.payment_source)}
                      </p>
                      <p className="mt-1 text-sm text-slate-500">{order.items.map((item) => `${item.menu_name} x${item.quantity}`).join(', ')}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={order.status} />
                      <StatusBadge status={order.payment_status} />
                    </div>
                  </div>
                </button>
              );
            })}

            {!ordersQuery.isLoading && !ordersQuery.data?.length ? (
              <p className="rounded-3xl bg-slate-50 p-5 text-sm text-slate-500">아직 표시할 주문이 없습니다.</p>
            ) : null}
          </div>
        </Panel>

        <Panel title="주문 상세">
          {selectedOrder ? (
            <div className="space-y-4">
              <div className="rounded-3xl bg-slate-50 p-4">
                <p className="text-sm text-slate-500">채널</p>
                <p className="font-bold text-slate-900">
                  {selectedOrder.table_no ? `테이블 ${selectedOrder.table_no}` : getOrderChannelLabel(selectedOrder.channel)}
                </p>
                <p className="mt-2 text-sm text-slate-500">결제 상태</p>
                <p className="font-semibold text-slate-700">
                  <StatusBadge status={selectedOrder.payment_status} />
                </p>
                <p className="mt-2 text-sm text-slate-500">결제 구분</p>
                <p className="font-semibold text-slate-700">
                  {getPaymentSourceLabel(selectedOrder.payment_source)}
                  {selectedOrder.payment_method ? ` · ${paymentMethodLabelMap[selectedOrder.payment_method]}` : ''}
                </p>
                <p className="mt-2 text-sm text-slate-500">고객 기억 연결</p>
                <p className="font-semibold text-slate-700">{selectedCustomerLabel}</p>
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
                    disabled={statusMutation.isPending}
                    onClick={() => statusMutation.mutate({ orderId: selectedOrder.id, status })}
                    type="button"
                  >
                    {orderStatusLabelMap[status]}
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  className="btn-secondary"
                  disabled={paymentMutation.isPending || selectedOrder.payment_status === 'paid'}
                  onClick={() => paymentMutation.mutate({ orderId: selectedOrder.id, paymentMethod: 'cash', paymentSource: 'counter' })}
                  type="button"
                >
                  카운터 현금 완료
                </button>
                <button
                  className="btn-secondary"
                  disabled={paymentMutation.isPending || selectedOrder.payment_status === 'paid'}
                  onClick={() => paymentMutation.mutate({ orderId: selectedOrder.id, paymentMethod: 'card', paymentSource: 'counter' })}
                  type="button"
                >
                  카운터 카드 완료
                </button>
                <button
                  className="btn-primary"
                  disabled={paymentMutation.isPending || selectedOrder.payment_status === 'paid'}
                  onClick={() => paymentMutation.mutate({ orderId: selectedOrder.id, paymentMethod: 'card', paymentSource: 'mobile' })}
                  type="button"
                >
                  모바일 결제 완료
                </button>
              </div>
            </div>
          ) : (
            <p className="rounded-3xl bg-slate-50 p-5 text-sm text-slate-500">주문을 선택하면 고객 기억과 결제 상태를 확인할 수 있습니다.</p>
          )}
        </Panel>
      </div>
    </div>
  );
}
