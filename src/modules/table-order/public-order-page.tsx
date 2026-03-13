import { useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { useStorePublicContext } from '@/app/layouts/StorePublicLayout';
import { Modal } from '@/shared/components/Modal';
import { Panel } from '@/shared/components/Panel';
import { formatCurrency } from '@/shared/lib/format';
import { queryKeys } from '@/shared/lib/queryKeys';
import { attachCustomerToOrder, submitPublicOrder } from '@/shared/lib/services/mvpService';

export function StoreOrderPage() {
  const { publicStore, tableNo } = useStorePublicContext();
  const queryClient = useQueryClient();
  const [cart, setCart] = useState<Record<string, number>>({});
  const [note, setNote] = useState('');
  const [latestOrderId, setLatestOrderId] = useState<string>();
  const [modalOpen, setModalOpen] = useState(false);
  const [customerForm, setCustomerForm] = useState({
    phone: '',
    name: '',
    email: '',
    marketingOptIn: true,
  });

  const cartItems = useMemo(
    () =>
      publicStore.menu.items
        .filter((item) => cart[item.id] > 0)
        .map((item) => ({
          item,
          quantity: cart[item.id],
        })),
    [cart, publicStore.menu.items],
  );

  const total = cartItems.reduce((sum, entry) => sum + entry.item.price * entry.quantity, 0);

  const orderMutation = useMutation({
    mutationFn: () =>
      submitPublicOrder({
        storeSlug: publicStore.store.slug,
        tableNo,
        items: cartItems.map((entry) => ({
          menu_item_id: entry.item.id,
          quantity: entry.quantity,
        })),
        note,
      }),
    onSuccess: async (result) => {
      setLatestOrderId(result.order.id);
      setCart({});
      setNote('');
      setModalOpen(true);
      await queryClient.invalidateQueries({ queryKey: queryKeys.publicStore(publicStore.store.slug) });
    },
  });

  const customerMutation = useMutation({
    mutationFn: () =>
      attachCustomerToOrder(publicStore.store.id, latestOrderId!, {
        phone: customerForm.phone,
        name: customerForm.name,
        email: customerForm.email,
        marketingOptIn: customerForm.marketingOptIn,
      }),
    onSuccess: () => {
      setModalOpen(false);
      setCustomerForm({ phone: '', name: '', email: '', marketingOptIn: true });
    },
  });

  const updateQuantity = (menuItemId: string, amount: number) => {
    setCart((current) => {
      const nextQuantity = Math.max((current[menuItemId] || 0) + amount, 0);
      return {
        ...current,
        [menuItemId]: nextQuantity,
      };
    });
  };

  return (
    <div className="grid gap-8 xl:grid-cols-[1.1fr_0.9fr]">
      <Panel title="메뉴 선택" subtitle={tableNo ? `현재 테이블: ${tableNo}` : '테이블 정보 없이 주문 중'}>
        <div className="space-y-4">
          {publicStore.menu.items.map((item) => (
            <div key={item.id} className="rounded-3xl border border-slate-200 p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-bold text-slate-900">{item.name}</p>
                  <p className="mt-1 text-sm text-slate-500">{item.description}</p>
                  <p className="mt-3 font-semibold text-slate-900">{formatCurrency(item.price)}</p>
                </div>
                <div className="flex items-center gap-3">
                  <button className="btn-secondary" onClick={() => updateQuantity(item.id, -1)} type="button">
                    -
                  </button>
                  <span className="w-10 text-center font-bold text-slate-900">{cart[item.id] || 0}</span>
                  <button className="btn-primary" onClick={() => updateQuantity(item.id, 1)} type="button">
                    +
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Panel>

      <Panel title="장바구니">
        <div className="space-y-4">
          {cartItems.length ? (
            cartItems.map((entry) => (
              <div key={entry.item.id} className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
                <span className="text-sm text-slate-700">{entry.item.name} x{entry.quantity}</span>
                <span className="font-semibold text-slate-900">{formatCurrency(entry.item.price * entry.quantity)}</span>
              </div>
            ))
          ) : (
            <p className="text-sm text-slate-500">메뉴를 담아 주세요.</p>
          )}
          <label>
            <span className="field-label">요청사항</span>
            <textarea className="input-base min-h-24" onChange={(event) => setNote(event.target.value)} value={note} />
          </label>
          <div className="rounded-3xl bg-slate-950 p-5 text-white">
            <p className="text-sm text-slate-300">총 결제 예상 금액</p>
            <p className="mt-2 font-display text-3xl font-black">{formatCurrency(total)}</p>
          </div>
          <button className="btn-primary w-full" disabled={!cartItems.length || orderMutation.isPending} onClick={() => orderMutation.mutate()} type="button">
            주문 제출
          </button>
        </div>
      </Panel>

      <Modal
        footer={
          <>
            <button className="btn-secondary" onClick={() => setModalOpen(false)} type="button">
              나중에
            </button>
            <button className="btn-primary" disabled={!latestOrderId} onClick={() => customerMutation.mutate()} type="button">
              고객 등록
            </button>
          </>
        }
        onClose={() => setModalOpen(false)}
        open={modalOpen}
        title="주문 감사합니다"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-500">전화번호를 입력하면 기존 고객 매칭 또는 신규 고객 생성으로 주문 이력이 연결됩니다.</p>
          <label>
            <span className="field-label">전화번호</span>
            <input className="input-base" onChange={(event) => setCustomerForm((current) => ({ ...current, phone: event.target.value }))} value={customerForm.phone} />
          </label>
          <label>
            <span className="field-label">이름</span>
            <input className="input-base" onChange={(event) => setCustomerForm((current) => ({ ...current, name: event.target.value }))} value={customerForm.name} />
          </label>
          <label>
            <span className="field-label">이메일</span>
            <input className="input-base" onChange={(event) => setCustomerForm((current) => ({ ...current, email: event.target.value }))} value={customerForm.email} />
          </label>
          <label className="flex items-center gap-3 rounded-2xl bg-slate-50 p-4 text-sm font-semibold text-slate-700">
            <input checked={customerForm.marketingOptIn} className="h-4 w-4 accent-orange-600" onChange={(event) => setCustomerForm((current) => ({ ...current, marketingOptIn: event.target.checked }))} type="checkbox" />
            마케팅 수신 동의
          </label>
        </div>
      </Modal>
    </div>
  );
}
