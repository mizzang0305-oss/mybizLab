import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { PageHeader } from '@/shared/components/PageHeader';
import { Panel } from '@/shared/components/Panel';
import { StatusBadge } from '@/shared/components/StatusBadge';
import { useCurrentStore } from '@/shared/hooks/useCurrentStore';
import { usePageMeta } from '@/shared/hooks/usePageMeta';
import { getCustomerDisplayLabel } from '@/shared/lib/customerDisplay';
import { formatCurrency, formatDateTime } from '@/shared/lib/format';
import {
  getOrderChannelLabel,
  getOrderNextAction,
  getOrderStatusLabel,
  getPaymentMethodLabel,
  getPaymentSourceLabel,
  getPaymentStatusLabel,
} from '@/shared/lib/merchantOperations';
import { queryKeys } from '@/shared/lib/queryKeys';
import { listOrders, recordOrderPayment, updateOrderStatus } from '@/shared/lib/services/mvpService';
import type { OrderPaymentMethod, OrderPaymentSource, OrderStatus } from '@/shared/types/models';

export function OrdersPage() {
  const { currentStore } = useCurrentStore();
  const queryClient = useQueryClient();
  const [selectedOrderId, setSelectedOrderId] = useState<string>();

  usePageMeta('주문 관리', '고객, 테이블, 주문 상태, 결제 상태, 다음 처리를 빠르게 확인하는 점주용 주문 관리 화면입니다.');

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
  const selectedOrderAction = selectedOrder ? getOrderNextAction(selectedOrder) : null;

  if (!currentStore) {
    return null;
  }

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="주문 현황"
        title="주문 관리"
        description="고객, 테이블, 주문 상태, 결제 상태, 다음 처리만 빠르게 확인합니다."
      />

      <div className="grid gap-8 xl:grid-cols-[1fr_0.75fr]">
        <Panel title="주문 목록" subtitle="고객 이름과 다음 액션을 먼저 보여줍니다.">
          <div className="space-y-3">
            {ordersQuery.data?.map((order) => {
              const customerLabel = getCustomerDisplayLabel({
                customer: order.customer,
                customerId: order.customer_id,
              });
              const nextAction = getOrderNextAction(order);
              const channelLabel = order.table_no ? `테이블 ${order.table_no}` : getOrderChannelLabel(order.channel);

              return (
                <button
                  key={order.id}
                  className={`w-full rounded-3xl border p-4 text-left transition ${selectedOrder?.id === order.id ? 'border-orange-300 bg-orange-50' : 'border-slate-200 bg-white'}`}
                  onClick={() => setSelectedOrderId(order.id)}
                  type="button"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-bold text-slate-900">{customerLabel}</p>
                      <p className="mt-1 text-sm font-semibold text-slate-700">{channelLabel}</p>
                      <p className="mt-1 text-sm text-slate-500">
                        주문 #{order.id.slice(-6)} · {formatDateTime(order.placed_at)} · {formatCurrency(order.total_amount)}
                      </p>
                      <p className="mt-2 text-sm text-slate-500">{order.items.map((item) => `${item.menu_name} x${item.quantity}`).join(', ')}</p>
                      <p className="mt-2 text-sm font-semibold text-orange-700">다음: {nextAction.label}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                      <StatusBadge label={getOrderStatusLabel(order.status)} status={order.status} />
                      <StatusBadge label={getPaymentStatusLabel(order.payment_status)} status={order.payment_status} />
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
                        {getPaymentSourceLabel(order.payment_source)}
                      </span>
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

        <Panel title="주문 상세" subtitle="다음 처리와 결제 처리만 우선 표시합니다.">
          {selectedOrder ? (
            <div className="space-y-4">
              <div className="rounded-3xl bg-slate-50 p-4">
                <p className="text-sm text-slate-500">고객</p>
                <p className="font-bold text-slate-900">{selectedCustomerLabel}</p>
                <p className="mt-2 text-sm text-slate-500">채널</p>
                <p className="font-bold text-slate-900">
                  {selectedOrder.table_no ? `테이블 ${selectedOrder.table_no}` : getOrderChannelLabel(selectedOrder.channel)}
                </p>
                <p className="mt-2 text-sm text-slate-500">주문 상태</p>
                <StatusBadge label={getOrderStatusLabel(selectedOrder.status)} status={selectedOrder.status} />
                <p className="mt-2 text-sm text-slate-500">결제 상태</p>
                <StatusBadge label={getPaymentStatusLabel(selectedOrder.payment_status)} status={selectedOrder.payment_status} />
                <p className="mt-2 text-sm text-slate-500">결제 구분</p>
                <p className="font-semibold text-slate-700">
                  {getPaymentSourceLabel(selectedOrder.payment_source)}
                  {selectedOrder.payment_method ? ` · ${getPaymentMethodLabel(selectedOrder.payment_method)}` : ''}
                </p>
              </div>
              <div className="rounded-3xl border border-slate-200 p-4">
                {selectedOrder.items.map((item) => (
                  <div key={item.id} className="flex items-center justify-between py-2 text-sm">
                    <span>{item.menu_name} x{item.quantity}</span>
                    <span className="font-semibold">{formatCurrency(item.line_total)}</span>
                  </div>
                ))}
              </div>
              <div className="rounded-3xl border border-orange-100 bg-orange-50 p-4">
                <p className="text-sm font-semibold text-orange-900">다음 액션</p>
                <p className="mt-1 text-sm leading-6 text-orange-800">{selectedOrderAction?.description}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {selectedOrderAction?.nextStatus ? (
                    <button
                      className="btn-primary"
                      disabled={statusMutation.isPending}
                      onClick={() => statusMutation.mutate({ orderId: selectedOrder.id, status: selectedOrderAction.nextStatus! })}
                      type="button"
                    >
                      {selectedOrderAction.label}
                    </button>
                  ) : (
                    <span className="rounded-full bg-white px-3 py-2 text-sm font-bold text-orange-800">{selectedOrderAction?.label}</span>
                  )}
                  {selectedOrder.status !== 'completed' && selectedOrder.status !== 'cancelled' ? (
                    <button
                      className="btn-secondary"
                      disabled={statusMutation.isPending}
                      onClick={() => statusMutation.mutate({ orderId: selectedOrder.id, status: 'cancelled' })}
                      type="button"
                    >
                      주문 취소
                    </button>
                  ) : null}
                </div>
              </div>
              {selectedOrder.payment_status !== 'paid' ? (
                <div className="flex flex-wrap gap-2">
                  <button
                    className="btn-secondary"
                    disabled={paymentMutation.isPending}
                    onClick={() => paymentMutation.mutate({ orderId: selectedOrder.id, paymentMethod: 'cash', paymentSource: 'counter' })}
                    type="button"
                  >
                    카운터 현금 결제 완료
                  </button>
                  <button
                    className="btn-secondary"
                    disabled={paymentMutation.isPending}
                    onClick={() => paymentMutation.mutate({ orderId: selectedOrder.id, paymentMethod: 'card', paymentSource: 'counter' })}
                    type="button"
                  >
                    카운터 카드 결제 완료
                  </button>
                  <button
                    className="btn-primary"
                    disabled={paymentMutation.isPending}
                    onClick={() => paymentMutation.mutate({ orderId: selectedOrder.id, paymentMethod: 'card', paymentSource: 'mobile' })}
                    type="button"
                  >
                    모바일 결제 완료로 표시
                  </button>
                </div>
              ) : (
                <p className="rounded-3xl bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">결제 완료 주문입니다.</p>
              )}
            </div>
          ) : (
            <p className="rounded-3xl bg-slate-50 p-5 text-sm text-slate-500">주문을 선택하면 고객 기억과 결제 상태를 확인할 수 있습니다.</p>
          )}
        </Panel>
      </div>
    </div>
  );
}
