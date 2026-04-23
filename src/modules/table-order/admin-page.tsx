import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';

import { PageHeader } from '@/shared/components/PageHeader';
import { Panel } from '@/shared/components/Panel';
import { StatusBadge } from '@/shared/components/StatusBadge';
import { formatCurrency, formatDateTime } from '@/shared/lib/format';
import { queryKeys } from '@/shared/lib/queryKeys';
import {
  createMenuCategory,
  createMenuItem,
  createStoreTable,
  getTableLiveBoard,
  listMenu,
  listStoreTables,
} from '@/shared/lib/services/mvpService';
import { buildStorePath } from '@/shared/lib/storeSlug';
import { useCurrentStore } from '@/shared/hooks/useCurrentStore';

export function TableOrderAdminPage() {
  const { currentStore } = useCurrentStore();
  const queryClient = useQueryClient();
  const [tableForm, setTableForm] = useState({ table_no: 'A1', seats: 4 });
  const [categoryName, setCategoryName] = useState('디저트');
  const [menuForm, setMenuForm] = useState({
    category_id: '',
    name: '',
    price: 6000,
    description: '',
    is_popular: false,
  });

  const tablesQuery = useQuery({
    queryKey: queryKeys.storeTables(currentStore?.id || ''),
    queryFn: () => listStoreTables(currentStore!.id),
    enabled: Boolean(currentStore),
  });

  const menuQuery = useQuery({
    queryKey: queryKeys.menu(currentStore?.id || ''),
    queryFn: () => listMenu(currentStore!.id),
    enabled: Boolean(currentStore),
  });

  const liveBoardQuery = useQuery({
    queryKey: queryKeys.tableLiveBoard(currentStore?.id || ''),
    queryFn: () => getTableLiveBoard(currentStore!.id),
    enabled: Boolean(currentStore),
  });

  useEffect(() => {
    if (!menuForm.category_id && menuQuery.data?.categories[0]) {
      setMenuForm((current) => ({ ...current, category_id: menuQuery.data!.categories[0].id }));
    }
  }, [menuForm.category_id, menuQuery.data]);

  const tableMutation = useMutation({
    mutationFn: () => createStoreTable(currentStore!.id, tableForm),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.storeTables(currentStore!.id) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.tableLiveBoard(currentStore!.id) }),
      ]);
    },
  });

  const categoryMutation = useMutation({
    mutationFn: () => createMenuCategory(currentStore!.id, categoryName),
    onSuccess: async (category) => {
      setCategoryName('');
      setMenuForm((current) => ({ ...current, category_id: category.id }));
      await queryClient.invalidateQueries({ queryKey: queryKeys.menu(currentStore!.id) });
    },
  });

  const menuMutation = useMutation({
    mutationFn: () => createMenuItem(currentStore!.id, menuForm),
    onSuccess: async () => {
      setMenuForm((current) => ({ ...current, name: '', price: 6000, description: '', is_popular: false }));
      await queryClient.invalidateQueries({ queryKey: queryKeys.menu(currentStore!.id) });
    },
  });

  if (!currentStore) {
    return null;
  }

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="테이블 주문"
        title="테이블 주문"
        description="테이블 목록, 메뉴, QR 주문 링크를 관리하고 고객용 주문 화면으로 바로 연결합니다."
        actions={
          <Link className="btn-primary" to={buildStorePath(currentStore.slug, 'order')}>
            공개 주문 화면 보기
          </Link>
        }
      />

      <div className="grid gap-8 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="space-y-8">
          <Panel title="테이블 등록">
            <div className="grid gap-4">
              <label>
                <span className="field-label">테이블 번호</span>
                <input className="input-base" onChange={(event) => setTableForm((current) => ({ ...current, table_no: event.target.value }))} value={tableForm.table_no} />
              </label>
              <label>
                <span className="field-label">좌석 수</span>
                <input className="input-base" min={1} onChange={(event) => setTableForm((current) => ({ ...current, seats: Number(event.target.value) }))} type="number" value={tableForm.seats} />
              </label>
              <button className="btn-primary" onClick={() => tableMutation.mutate()} type="button">
                테이블 저장
              </button>
            </div>
          </Panel>

          <Panel title="메뉴 카테고리 추가">
            <div className="flex flex-col gap-3 sm:flex-row">
              <input className="input-base" onChange={(event) => setCategoryName(event.target.value)} value={categoryName} />
              <button className="btn-secondary" onClick={() => categoryMutation.mutate()} type="button">
                카테고리 생성
              </button>
            </div>
          </Panel>

          <Panel title="메뉴 등록">
            <div className="grid gap-4">
              <label>
                <span className="field-label">카테고리</span>
                <select className="input-base" onChange={(event) => setMenuForm((current) => ({ ...current, category_id: event.target.value }))} value={menuForm.category_id}>
                  {menuQuery.data?.categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span className="field-label">메뉴명</span>
                <input className="input-base" onChange={(event) => setMenuForm((current) => ({ ...current, name: event.target.value }))} value={menuForm.name} />
              </label>
              <label>
                <span className="field-label">가격</span>
                <input className="input-base" min={0} onChange={(event) => setMenuForm((current) => ({ ...current, price: Number(event.target.value) }))} type="number" value={menuForm.price} />
              </label>
              <label>
                <span className="field-label">설명</span>
                <textarea className="input-base min-h-24" onChange={(event) => setMenuForm((current) => ({ ...current, description: event.target.value }))} value={menuForm.description} />
              </label>
              <label className="flex items-center gap-3 rounded-2xl bg-slate-50 p-4 text-sm font-semibold text-slate-700">
                <input checked={menuForm.is_popular} className="h-4 w-4 accent-orange-600" onChange={(event) => setMenuForm((current) => ({ ...current, is_popular: event.target.checked }))} type="checkbox" />
                인기 메뉴 표시
              </label>
              <button className="btn-primary" onClick={() => menuMutation.mutate()} type="button">
                메뉴 저장
              </button>
            </div>
          </Panel>
        </div>

        <div className="space-y-8">
          <Panel title="테이블 라이브 보드" subtitle="주문, 결제, 고객 기억이 테이블 기준으로 어디까지 연결됐는지 바로 확인합니다.">
            <div className="space-y-3">
              {liveBoardQuery.data?.map((row) => (
                <div key={row.tableId} className="rounded-3xl border border-slate-200 p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-bold text-slate-900">테이블 {row.tableNo}</p>
                        <StatusBadge status={row.activeOrderCount ? 'active' : 'pending'} />
                        {row.latestTicketStatus ? <StatusBadge status={row.latestTicketStatus} /> : null}
                      </div>
                      <p className="mt-2 text-sm text-slate-500">
                        좌석 {row.seats}석 · 진행중 주문 {row.activeOrderCount}건 · 미결제 {row.pendingPaymentCount}건 · 결제완료 {row.paidOrderCount}건
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Link className="btn-secondary" to={`${buildStorePath(currentStore.slug, 'order')}?table=${row.tableNo}`}>
                        QR 주문 열기
                      </Link>
                      <Link className="btn-secondary" to="/dashboard/orders">
                        주문 화면 열기
                      </Link>
                    </div>
                  </div>

                  {row.tableOrders.length ? (
                    <div className="mt-4 grid gap-3 lg:grid-cols-[1.05fr_0.95fr]">
                      <div className="space-y-3">
                        {row.tableOrders.slice(0, 3).map((order) => (
                          <div key={order.id} className="rounded-2xl bg-slate-50 p-4">
                            <div className="flex flex-wrap items-center gap-2">
                              <StatusBadge status={order.status} />
                              <StatusBadge status={order.payment_status} />
                              {order.payment_source ? (
                                <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-600">
                                  {order.payment_source === 'counter' ? '카운터 결제' : '모바일 결제'}
                                </span>
                              ) : null}
                            </div>
                            <p className="mt-3 text-sm font-semibold text-slate-900">
                              {order.customer?.name || '미등록 고객'} · {formatCurrency(order.total_amount)}
                            </p>
                            <p className="mt-2 text-sm text-slate-500">{order.items.map((item) => `${item.menu_name} x${item.quantity}`).join(', ')}</p>
                            <p className="mt-2 text-xs text-slate-400">{formatDateTime(order.placed_at)}</p>
                          </div>
                        ))}
                      </div>

                      <div className="space-y-3">
                        <div className="rounded-2xl bg-slate-50 p-4">
                          <p className="text-sm font-semibold text-slate-500">최근 고객 기억</p>
                          {row.recentTimeline.length ? (
                            <div className="mt-3 space-y-2">
                              {row.recentTimeline.map((event) => (
                                <div key={event.id} className="rounded-2xl bg-white px-4 py-3 text-sm text-slate-700">
                                  <p className="font-semibold text-slate-900">{event.summary}</p>
                                  <p className="mt-1 text-xs text-slate-400">{formatDateTime(event.occurred_at)}</p>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="mt-3 text-sm text-slate-500">연결된 고객 기억이 아직 없습니다.</p>
                          )}
                        </div>

                        <div className="rounded-2xl bg-slate-50 p-4">
                          <p className="text-sm font-semibold text-slate-500">최근 AI 상담 / 문의</p>
                          {row.recentConversation ? (
                            <div className="mt-3 rounded-2xl bg-white px-4 py-3 text-sm text-slate-700">
                              <p className="font-semibold text-slate-900">{row.recentConversation.subject}</p>
                              <p className="mt-1 text-xs text-slate-400">
                                {row.recentConversation.channel === 'ai_chat' ? 'AI 상담' : '문의 세션'}
                                {row.recentConversation.lastMessageAt
                                  ? ` · ${formatDateTime(row.recentConversation.lastMessageAt)}`
                                  : ''}
                              </p>
                              {row.recentConversation.lastAssistantReply ? (
                                <p className="mt-3 line-clamp-4 leading-6 text-slate-600">{row.recentConversation.lastAssistantReply}</p>
                              ) : null}
                            </div>
                          ) : (
                            <p className="mt-3 text-sm text-slate-500">연결된 상담/문의 세션이 아직 없습니다.</p>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <p className="mt-4 text-sm text-slate-500">아직 이 테이블에 연결된 주문이 없습니다.</p>
                  )}
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="테이블 및 QR 링크">
            <div className="space-y-3">
              {tablesQuery.data?.map((table) => (
                <div key={table.id} className="rounded-3xl border border-slate-200 p-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-bold text-slate-900">테이블 {table.table_no}</p>
                      <p className="text-sm text-slate-500">좌석 {table.seats}석</p>
                    </div>
                    <Link className="btn-secondary" to={`${buildStorePath(currentStore.slug, 'order')}?table=${table.table_no}`}>
                      QR 주문 열기
                    </Link>
                  </div>
                  <p className="mt-3 break-all rounded-2xl bg-slate-50 p-3 text-xs text-slate-600">{table.qr_value}</p>
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="메뉴 현황">
            <div className="space-y-4">
              {menuQuery.data?.categories.map((category) => (
                <div key={category.id} className="rounded-3xl border border-slate-200 p-4">
                  <p className="font-bold text-slate-900">{category.name}</p>
                  <div className="mt-3 space-y-2">
                    {menuQuery.data.items
                      .filter((item) => item.category_id === category.id)
                      .map((item) => (
                        <div key={item.id} className="rounded-2xl bg-slate-50 p-3 text-sm text-slate-700">
                          {item.name} · {item.price.toLocaleString('ko-KR')}원
                        </div>
                      ))}
                  </div>
                </div>
              ))}
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
