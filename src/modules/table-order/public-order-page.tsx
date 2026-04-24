import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';

import { useStorePublicContext } from '@/app/layouts/StorePublicLayout';
import { Modal } from '@/shared/components/Modal';
import { Panel } from '@/shared/components/Panel';
import { formatCurrency } from '@/shared/lib/format';
import {
  getPublicOrderPaymentErrorMessage,
  launchPublicOrderPaymentCheckout,
  verifyPublicOrderPayment,
} from '@/shared/lib/publicOrderPayment';
import { attachCustomerToOrder, submitPublicOrder } from '@/shared/lib/services/mvpService';

type MessageTone = 'error' | 'info' | 'success';

type MessageState = {
  text: string;
  tone: MessageTone;
};

export function StoreOrderPage() {
  const { publicStore, publicStoreQueryKey, tableNo } = useStorePublicContext();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [cart, setCart] = useState<Record<string, number>>({});
  const [note, setNote] = useState('');
  const [latestOrderId, setLatestOrderId] = useState<string>();
  const [message, setMessage] = useState<MessageState | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [paymentSource, setPaymentSource] = useState<'counter' | 'mobile'>(tableNo ? 'mobile' : 'counter');
  const [customerForm, setCustomerForm] = useState({
    email: '',
    marketingOptIn: true,
    name: '',
    phone: '',
  });
  const redirectHandledRef = useRef<string | null>(null);

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

  async function invalidatePublicStore() {
    await queryClient.invalidateQueries({ queryKey: publicStoreQueryKey });
  }

  function resetComposer() {
    setCart({});
    setNote('');
  }

  async function handleVerifiedMobilePayment(orderId: string, paymentId: string, source: 'browser' | 'redirect') {
    await verifyPublicOrderPayment({
      orderId,
      paymentId,
      storeSlug: publicStore.store.slug,
    });

    setLatestOrderId(orderId);
    setModalOpen(true);
    setMessage({
      tone: 'success',
      text:
        source === 'redirect'
          ? '모바일 결제가 확인되었습니다. 주문이 매장 운영 화면과 고객 메모리에 연결됩니다.'
          : '모바일 결제가 완료되었습니다. 주문이 매장 운영 화면에 반영되었습니다.',
    });
    resetComposer();
    await invalidatePublicStore();
  }

  const orderMutation = useMutation({
    mutationFn: async () => {
      const orderResult = await submitPublicOrder({
        storeSlug: publicStore.store.slug,
        tableNo,
        items: cartItems.map((entry) => ({
          menu_item_id: entry.item.id,
          quantity: entry.quantity,
        })),
        note,
        paymentMethod: paymentSource === 'counter' ? 'cash' : 'card',
        paymentSource,
      });

      if (paymentSource === 'mobile') {
        const checkout = await launchPublicOrderPaymentCheckout({
          customer: {
            email: customerForm.email.trim() || undefined,
            fullName: customerForm.name.trim() || undefined,
            phoneNumber: customerForm.phone.trim() || undefined,
          },
          orderId: orderResult.order.id,
          redirectPath: `${window.location.pathname}${window.location.search}`,
          returnOrigin: window.location.origin,
          storeSlug: publicStore.store.slug,
        });

        return {
          checkout,
          orderResult,
          paymentSource,
        };
      }

      return {
        orderResult,
        paymentSource,
      };
    },
    onError: (error) => {
      setMessage({
        tone: 'error',
        text: error instanceof Error ? error.message : '주문 또는 결제를 처리하는 중 문제가 발생했습니다.',
      });
    },
    onSuccess: async (result) => {
      const orderId = result.orderResult.order.id;
      setLatestOrderId(orderId);

      if (result.paymentSource === 'counter') {
        setMessage({
          tone: 'success',
          text: '주문이 접수되었습니다. 카운터 결제 완료는 매장 운영 화면에서 기록됩니다.',
        });
        setModalOpen(true);
        resetComposer();
        await invalidatePublicStore();
        return;
      }

      const payment = result.checkout.payment;
      if (!payment) {
        setMessage({
          tone: 'info',
          text: '모바일 결제를 진행 중입니다. 결제가 완료되면 이 화면으로 돌아와 자동 확인됩니다.',
        });
        resetComposer();
        await invalidatePublicStore();
        return;
      }

      if (payment.code) {
        setMessage({
          tone: 'error',
          text: `${getPublicOrderPaymentErrorMessage(payment)} 주문은 미결제로 접수되어 매장에서 다시 확인할 수 있습니다.`,
        });
        resetComposer();
        await invalidatePublicStore();
        return;
      }

      await handleVerifiedMobilePayment(orderId, payment.paymentId, 'browser');
    },
  });

  const customerMutation = useMutation({
    mutationFn: () =>
      attachCustomerToOrder(publicStore.store.id, latestOrderId!, {
        email: customerForm.email,
        marketingOptIn: customerForm.marketingOptIn,
        name: customerForm.name,
        phone: customerForm.phone,
      }),
    onError: (error) => {
      setMessage({
        tone: 'error',
        text: error instanceof Error ? error.message : '고객 정보를 주문에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.',
      });
    },
    onSuccess: async () => {
      setModalOpen(false);
      setCustomerForm({ email: '', marketingOptIn: true, name: '', phone: '' });
      setMessage({
        tone: 'success',
        text: '주문이 고객 메모리와 연결되었습니다. 운영 화면에서 다음 응대를 이어갈 수 있습니다.',
      });
      await invalidatePublicStore();
    },
  });

  useEffect(() => {
    const portone = searchParams.get('portone');
    if (portone !== 'public-order') {
      return;
    }

    const orderId = searchParams.get('orderId') || '';
    const paymentId = searchParams.get('paymentId') || '';
    const code = searchParams.get('code') || '';
    const messageText = searchParams.get('message') || '';
    const signature = `${portone}:${orderId}:${paymentId}:${code}`;

    if (redirectHandledRef.current === signature) {
      return;
    }
    redirectHandledRef.current = signature;

    const next = new URLSearchParams(searchParams);
    ['portone', 'orderId', 'paymentId', 'code', 'message'].forEach((key) => next.delete(key));
    setSearchParams(next, { replace: true });

    if (orderId) {
      setLatestOrderId(orderId);
    }

    if (code) {
      setMessage({
        tone: 'error',
        text: messageText || '모바일 결제가 완료되지 않았습니다. 주문은 미결제로 남아 매장에서 다시 확인할 수 있습니다.',
      });
      return;
    }

    if (!orderId || !paymentId) {
      setMessage({
        tone: 'error',
        text: '모바일 결제 결과를 확인할 수 없습니다. 주문 상태를 다시 확인해 주세요.',
      });
      return;
    }

    void handleVerifiedMobilePayment(orderId, paymentId, 'redirect').catch((error) => {
      setMessage({
        tone: 'error',
        text: error instanceof Error ? error.message : '모바일 결제 확인에 실패했습니다.',
      });
    });
  }, [searchParams, setSearchParams]);

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
      <Panel title="메뉴 선택" subtitle={tableNo ? `현재 테이블 ${tableNo}` : '테이블 정보 없이 주문 중'}>
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
          {message ? (
            <div
              className={`rounded-2xl border px-4 py-3 text-sm leading-6 ${
                message.tone === 'success'
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                  : message.tone === 'error'
                    ? 'border-rose-200 bg-rose-50 text-rose-700'
                    : 'border-slate-200 bg-slate-50 text-slate-700'
              }`}
            >
              {message.text}
              {latestOrderId ? <p className="mt-2 font-semibold">주문 번호: {latestOrderId}</p> : null}
            </div>
          ) : null}

          {cartItems.length ? (
            cartItems.map((entry) => (
              <div key={entry.item.id} className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
                <span className="text-sm text-slate-700">
                  {entry.item.name} x{entry.quantity}
                </span>
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

          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-semibold text-slate-900">결제 방식</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <button
                className={`rounded-2xl border px-4 py-3 text-left transition ${
                  paymentSource === 'counter'
                    ? 'border-slate-900 bg-slate-900 text-white'
                    : 'border-slate-200 bg-white text-slate-700'
                }`}
                onClick={() => setPaymentSource('counter')}
                type="button"
              >
                <p className="font-semibold">매장에서 결제</p>
                <p className={`mt-2 text-sm leading-6 ${paymentSource === 'counter' ? 'text-slate-200' : 'text-slate-500'}`}>
                  카운터 결제 주문으로 접수되고 점주가 결제 완료를 기록합니다.
                </p>
              </button>
              <button
                className={`rounded-2xl border px-4 py-3 text-left transition ${
                  paymentSource === 'mobile'
                    ? 'border-slate-900 bg-slate-900 text-white'
                    : 'border-slate-200 bg-white text-slate-700'
                }`}
                onClick={() => setPaymentSource('mobile')}
                type="button"
              >
                <p className="font-semibold">모바일 결제</p>
                <p className={`mt-2 text-sm leading-6 ${paymentSource === 'mobile' ? 'text-slate-200' : 'text-slate-500'}`}>
                  PortOne 카드 결제로 바로 확인합니다. 미완료 시 주문은 미결제로 남아 매장에서 다시 확인할 수 있습니다.
                </p>
              </button>
            </div>
          </div>

          <button
            className="btn-primary w-full"
            disabled={!cartItems.length || orderMutation.isPending}
            onClick={() => orderMutation.mutate()}
            type="button"
          >
            {orderMutation.isPending ? (paymentSource === 'mobile' ? '주문/결제 진행 중...' : '주문 접수 중...') : '주문 제출'}
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
          <p className="text-sm text-slate-500">
            전화번호를 남기면 이 주문을 기존 고객 메모리와 연결하거나 새 고객으로 저장할 수 있습니다.
          </p>
          <label>
            <span className="field-label">전화번호</span>
            <input
              className="input-base"
              onChange={(event) => setCustomerForm((current) => ({ ...current, phone: event.target.value }))}
              value={customerForm.phone}
            />
          </label>
          <label>
            <span className="field-label">이름</span>
            <input
              className="input-base"
              onChange={(event) => setCustomerForm((current) => ({ ...current, name: event.target.value }))}
              value={customerForm.name}
            />
          </label>
          <label>
            <span className="field-label">이메일</span>
            <input
              className="input-base"
              onChange={(event) => setCustomerForm((current) => ({ ...current, email: event.target.value }))}
              value={customerForm.email}
            />
          </label>
          <label className="flex items-center gap-3 rounded-2xl bg-slate-50 p-4 text-sm font-semibold text-slate-700">
            <input
              checked={customerForm.marketingOptIn}
              className="h-4 w-4 accent-orange-600"
              onChange={(event) =>
                setCustomerForm((current) => ({
                  ...current,
                  marketingOptIn: event.target.checked,
                }))
              }
              type="checkbox"
            />
            마케팅 수신 동의
          </label>
        </div>
      </Modal>
    </div>
  );
}
