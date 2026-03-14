import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { PageHeader } from '@/shared/components/PageHeader';
import { Panel } from '@/shared/components/Panel';
import { StatusBadge } from '@/shared/components/StatusBadge';
import { formatCurrency } from '@/shared/lib/format';
import { queryKeys } from '@/shared/lib/queryKeys';
import { listKitchenTickets, updateKitchenTicketStatus } from '@/shared/lib/services/mvpService';
import { useCurrentStore } from '@/shared/hooks/useCurrentStore';
import type { KitchenTicket } from '@/shared/types/models';

const columns: KitchenTicket['status'][] = ['pending', 'accepted', 'preparing', 'ready', 'completed'];

export function KitchenPage() {
  const { currentStore } = useCurrentStore();
  const queryClient = useQueryClient();
  const ticketsQuery = useQuery({
    queryKey: queryKeys.kitchen(currentStore?.id || ''),
    queryFn: () => listKitchenTickets(currentStore!.id),
    enabled: Boolean(currentStore),
    refetchInterval: 3_000,
  });

  const statusMutation = useMutation({
    mutationFn: ({ ticketId, status }: { ticketId: string; status: KitchenTicket['status'] }) =>
      updateKitchenTicketStatus(currentStore!.id, ticketId, status),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.kitchen(currentStore!.id) });
      await queryClient.invalidateQueries({ queryKey: queryKeys.orders(currentStore!.id) });
      await queryClient.invalidateQueries({ queryKey: queryKeys.sales(currentStore!.id) });
    },
  });

  const grouped = useMemo(() => {
    const map = new Map<KitchenTicket['status'], Awaited<ReturnType<typeof listKitchenTickets>>>();
    columns.forEach((status) => map.set(status, []));
    ticketsQuery.data?.forEach((ticket) => {
      const existing = map.get(ticket.status) || [];
      existing.push(ticket);
      map.set(ticket.status, existing);
    });
    return map;
  }, [ticketsQuery.data]);

  if (!currentStore) {
    return null;
  }

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Kitchen board"
        title="주방 보드"
        description="pending / accepted / preparing / ready / completed 상태를 실시간 또는 polling으로 확인합니다."
      />

      <div className="grid gap-6 xl:grid-cols-5">
        {columns.map((column) => (
          <Panel key={column} className="p-4" title={column.toUpperCase()}>
            <div className="space-y-3">
              {(grouped.get(column) || []).map((ticket) => (
                <div key={ticket.id} className="rounded-3xl border border-slate-200 p-4">
                  <div className="flex items-center justify-between">
                    <p className="font-bold text-slate-900">{ticket.table_no ? `Table ${ticket.table_no}` : 'Walk-in'}</p>
                    <StatusBadge status={ticket.status} />
                  </div>
                  <p className="mt-2 text-sm text-slate-500">{ticket.items.map((item) => `${item.menu_name} x${item.quantity}`).join(', ')}</p>
                  <p className="mt-2 text-sm font-semibold text-slate-700">{formatCurrency(ticket.order?.total_amount || 0)}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {columns
                      .filter((status) => status !== ticket.status)
                      .map((status) => (
                        <button
                          key={status}
                          className="btn-secondary"
                          onClick={() => statusMutation.mutate({ ticketId: ticket.id, status })}
                          type="button"
                        >
                          {status}
                        </button>
                      ))}
                  </div>
                </div>
              ))}
            </div>
          </Panel>
        ))}
      </div>
    </div>
  );
}
