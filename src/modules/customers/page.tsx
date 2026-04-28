import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { EmptyState } from '@/shared/components/EmptyState';
import { MetricCard } from '@/shared/components/MetricCard';
import { PageHeader } from '@/shared/components/PageHeader';
import { Panel } from '@/shared/components/Panel';
import { StatusBadge } from '@/shared/components/StatusBadge';
import { useCurrentStore } from '@/shared/hooks/useCurrentStore';
import { usePageMeta } from '@/shared/hooks/usePageMeta';
import { getCustomerDisplayLabel } from '@/shared/lib/customerDisplay';
import { customerContactSchema, inquiryStatusValues, normalizeInquiryTags } from '@/shared/lib/inquirySchema';
import { formatCurrency, formatDateTime } from '@/shared/lib/format';
import {
  getInquiryStatusLabel,
  getOrderChannelLabel,
  getOrderStatusLabel,
  getPaymentStatusLabel,
} from '@/shared/lib/merchantOperations';
import { queryKeys } from '@/shared/lib/queryKeys';
import {
  listConversationMessages,
  listConversationSessions,
  listCustomerTimelineEvents,
  listCustomers,
  listInquiries,
  listOrders,
  updateInquiryRecord,
  upsertCustomer,
} from '@/shared/lib/services/mvpService';

const initialCustomerForm = {
  id: '',
  name: '',
  phone: '',
  email: '',
  marketing_opt_in: false,
};

const inquiryStatusOptions: Array<{ label: string; value: (typeof inquiryStatusValues)[number] }> = [
  { label: '신규 문의', value: 'new' },
  { label: '응대중', value: 'in_progress' },
  { label: '처리 완료', value: 'completed' },
  { label: '보류', value: 'on_hold' },
];

const inquiryCategoryLabelMap: Record<string, string> = {
  general: '일반 문의',
  reservation: '예약 문의',
  group_booking: '단체 예약',
  event: '행사 문의',
  brand: '브랜드 문의',
};

const conversationChannelLabelMap: Record<string, string> = {
  ai_chat: 'AI 상담',
  dashboard_manual: '수기 상담',
  public_inquiry: '공개 문의',
};

export function CustomersPage() {
  const { currentStore } = useCurrentStore();
  const queryClient = useQueryClient();
  const [selectedInquiryId, setSelectedInquiryId] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [customerForm, setCustomerForm] = useState(initialCustomerForm);
  const [customerErrors, setCustomerErrors] = useState<Partial<Record<keyof typeof initialCustomerForm, string>>>({});
  const [customerMessage, setCustomerMessage] = useState<string | null>(null);
  const [inquiryTagsText, setInquiryTagsText] = useState('');
  const [inquiryMemo, setInquiryMemo] = useState('');
  const [inquiryStatus, setInquiryStatus] = useState<(typeof inquiryStatusValues)[number]>('new');
  const [inquiryMessage, setInquiryMessage] = useState<string | null>(null);
  const [selectedConversationSessionId, setSelectedConversationSessionId] = useState('');

  usePageMeta('고객 기억 관리', '문의함, 응대 상태, 고객 정보, 최근 주문 흐름을 한 화면에서 보는 점주용 고객 기억 화면입니다.');

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

  const inquiriesQuery = useQuery({
    queryKey: queryKeys.inquiries(currentStore?.id || ''),
    queryFn: () => listInquiries(currentStore!.id),
    enabled: Boolean(currentStore),
  });

  const conversationSessionsQuery = useQuery({
    queryKey: queryKeys.conversationSessions(currentStore?.id || ''),
    queryFn: () => listConversationSessions(currentStore!.id),
    enabled: Boolean(currentStore),
  });

  const customerMutation = useMutation({
    mutationFn: () => upsertCustomer(currentStore!.id, customerForm),
    onSuccess: async () => {
      setCustomerMessage('고객 정보를 저장했습니다.');
      setCustomerErrors({});
      await queryClient.invalidateQueries({ queryKey: queryKeys.customers(currentStore!.id) });
    },
    onError: (error) => {
      setCustomerMessage(error instanceof Error ? error.message : '고객 정보를 저장하지 못했습니다.');
    },
  });

  const inquiryMutation = useMutation({
    mutationFn: () =>
      updateInquiryRecord(currentStore!.id, selectedInquiryId, {
        status: inquiryStatus,
        tags: normalizeInquiryTags(inquiryTagsText.split(',')),
        memo: inquiryMemo,
      }),
    onSuccess: async () => {
      setInquiryMessage('문의 응대 상태를 저장했습니다.');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.inquiries(currentStore!.id) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.publicInquiry(currentStore!.id) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.publicStoreById(currentStore!.id) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.dashboard(currentStore!.id) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.aiReports(currentStore!.id) }),
      ]);
    },
    onError: (error) => {
      setInquiryMessage(error instanceof Error ? error.message : '문의 응대 저장에 실패했습니다.');
    },
  });

  const customers = customersQuery.data || [];
  const orders = ordersQuery.data || [];
  const inquiries = inquiriesQuery.data || [];
  const conversationSessions = conversationSessionsQuery.data || [];

  useEffect(() => {
    if (!selectedInquiryId && inquiries[0]) {
      setSelectedInquiryId(inquiries[0].id);
    }

    if (selectedInquiryId && !inquiries.some((inquiry) => inquiry.id === selectedInquiryId)) {
      setSelectedInquiryId(inquiries[0]?.id || '');
    }
  }, [inquiries, selectedInquiryId]);

  useEffect(() => {
    if (!selectedCustomerId && customers[0]) {
      setSelectedCustomerId(customers[0].id);
    }

    if (selectedCustomerId && !customers.some((customer) => customer.id === selectedCustomerId)) {
      setSelectedCustomerId(customers[0]?.id || '');
    }
  }, [customers, selectedCustomerId]);

  const selectedInquiry = inquiries.find((inquiry) => inquiry.id === selectedInquiryId) || inquiries[0] || null;
  const selectedCustomer =
    customers.find((customer) => customer.id === selectedCustomerId) ||
    customers.find((customer) => customer.id === selectedInquiry?.customer_id) ||
    customers[0] ||
    null;
  const selectedCustomerLabel = selectedCustomer
    ? getCustomerDisplayLabel({
        customer: selectedCustomer,
        customerId: selectedCustomer.id,
      })
    : '';
  const relatedOrders = orders.filter((order) => order.customer?.id === selectedCustomer?.id || order.customer_id === selectedCustomer?.id);
  const relatedConversationSessions = conversationSessions.filter((session) => {
    if (selectedInquiry?.id && session.inquiry_id === selectedInquiry.id) {
      return true;
    }

    return Boolean(selectedCustomer?.id && session.customer_id === selectedCustomer.id);
  });
  const selectedConversationSession =
    relatedConversationSessions.find((session) => session.id === selectedConversationSessionId) ||
    relatedConversationSessions[0] ||
    null;
  const openInquiryCount = inquiries.filter((inquiry) => inquiry.status !== 'completed').length;
  const regularCustomerCount = customers.filter((customer) => customer.is_regular).length;

  const conversationMessagesQuery = useQuery({
    queryKey: queryKeys.conversationMessages(selectedConversationSession?.id || ''),
    queryFn: () => listConversationMessages(selectedConversationSession!.id),
    enabled: Boolean(selectedConversationSession?.id),
  });

  const customerTimelineQuery = useQuery({
    queryKey: [...queryKeys.customers(currentStore?.id || ''), 'timeline', selectedCustomer?.id || ''],
    queryFn: () => listCustomerTimelineEvents(currentStore!.id, selectedCustomer!.id),
    enabled: Boolean(currentStore && selectedCustomer?.id),
  });
  const conversationMessages = conversationMessagesQuery.data || [];
  const customerTimeline = customerTimelineQuery.data || [];

  useEffect(() => {
    if (!selectedConversationSessionId && relatedConversationSessions[0]) {
      setSelectedConversationSessionId(relatedConversationSessions[0].id);
      return;
    }

    if (
      selectedConversationSessionId &&
      !relatedConversationSessions.some((session) => session.id === selectedConversationSessionId)
    ) {
      setSelectedConversationSessionId(relatedConversationSessions[0]?.id || '');
    }
  }, [relatedConversationSessions, selectedConversationSessionId]);

  useEffect(() => {
    if (!selectedInquiry) {
      setInquiryStatus('new');
      setInquiryTagsText('');
      setInquiryMemo('');
      return;
    }

    setInquiryStatus(selectedInquiry.status);
    setInquiryTagsText(selectedInquiry.tags.join(', '));
    setInquiryMemo(selectedInquiry.memo || '');
    if (selectedInquiry.customer_id) {
      setSelectedCustomerId(selectedInquiry.customer_id);
    }
  }, [selectedInquiry]);

  if (!currentStore) {
    return (
      <EmptyState
        title="고객 관리 화면을 준비하는 중입니다"
        description="매장 선택 정보를 불러오는 중입니다. 매장이 준비되면 고객 관리 화면을 바로 사용할 수 있습니다."
      />
    );
  }

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="고객 관리"
        title="고객 기억 관리"
        description="문의, 상담, 주문, 타임라인을 고객 기준으로 묶어 다음 응대를 바로 정리합니다."
      />

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard accent="blue" label="전체 고객" value={customers.length} />
        <MetricCard accent="emerald" label="단골 고객" value={regularCustomerCount} />
        <MetricCard accent="orange" label="미처리 문의" value={openInquiryCount} />
        <MetricCard accent="slate" label="전체 문의" value={inquiries.length} />
      </div>

      <div className="grid gap-8 xl:grid-cols-[1.02fr_0.98fr]">
        <Panel title="문의함" subtitle="사장님이 위에서 아래로 바로 훑어볼 수 있게 단순하게 정리한 목록입니다.">
          {inquiries.length ? (
            <div className="space-y-3">
              {inquiries.map((inquiry) => (
                <button
                  className={`w-full rounded-[28px] border p-4 text-left transition ${
                    selectedInquiry?.id === inquiry.id ? 'border-orange-300 bg-orange-50' : 'border-slate-200 bg-white'
                  }`}
                  key={inquiry.id}
                  onClick={() => setSelectedInquiryId(inquiry.id)}
                  type="button"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-bold text-slate-900">{inquiry.customer_name || inquiry.phone || '고객 정보 없음'}</p>
                        <StatusBadge label={getInquiryStatusLabel(inquiry.status)} status={inquiry.status} />
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
                          {inquiryCategoryLabelMap[inquiry.category] || inquiry.category}
                        </span>
                      </div>
                      <p className="mt-2 text-sm leading-6 text-slate-500">{inquiry.message}</p>
                      <p className="mt-2 text-xs text-slate-400">{formatDateTime(inquiry.created_at)}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {inquiry.tags.map((tag) => (
                        <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700" key={`${inquiry.id}-${tag}`}>
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <EmptyState title="아직 문의가 없습니다" description="공개 매장이나 문의 폼으로 첫 문의가 들어오면 이곳에 바로 표시됩니다." />
          )}
        </Panel>

        <Panel title="문의 응대" subtitle="상태, 태그, 메모를 짧게 정리해 모바일에서도 빠르게 업데이트할 수 있게 했습니다.">
          {selectedInquiry ? (
            <div className="space-y-5">
              <div className="rounded-[28px] border border-slate-200 bg-white p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-xl font-black text-slate-900">{selectedInquiry.customer_name || selectedInquiry.phone || '고객 정보 없음'}</p>
                  <StatusBadge label={getInquiryStatusLabel(selectedInquiry.status)} status={selectedInquiry.status} />
                </div>
                <p className="mt-3 text-sm leading-7 text-slate-600">{selectedInquiry.message}</p>
                <div className="mt-4 grid gap-3 text-sm text-slate-500 sm:grid-cols-2">
                  <p>
                    <span className="font-semibold text-slate-900">전화번호</span>
                    <br />
                    {selectedInquiry.phone}
                  </p>
                  <p>
                    <span className="font-semibold text-slate-900">이메일</span>
                    <br />
                    {selectedInquiry.email || '-'}
                  </p>
                  <p>
                    <span className="font-semibold text-slate-900">방문 희망일</span>
                    <br />
                    {selectedInquiry.requested_visit_date || '-'}
                  </p>
                  <p>
                    <span className="font-semibold text-slate-900">접수 경로</span>
                    <br />
                    {selectedInquiry.source === 'public_form' ? '공개 매장 문의 폼' : '관리자 수기 등록'}
                  </p>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {inquiryStatusOptions.map((option) => (
                  <button
                    className={`rounded-2xl border px-4 py-3 text-sm font-semibold transition ${
                      inquiryStatus === option.value ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-slate-50 text-slate-700'
                    }`}
                    key={option.value}
                    onClick={() => {
                      setInquiryStatus(option.value);
                      setInquiryMessage(null);
                    }}
                    type="button"
                  >
                    {option.label}
                  </button>
                ))}
              </div>

              <label>
                <span className="field-label">태그</span>
                <input
                  className="input-base"
                  onChange={(event) => {
                    setInquiryTagsText(event.target.value);
                    setInquiryMessage(null);
                  }}
                  placeholder="예: 단골, 저녁예약, 재연락"
                  value={inquiryTagsText}
                />
              </label>

              <label>
                <span className="field-label">응대 메모</span>
                <textarea
                  className="input-base min-h-28"
                  onChange={(event) => {
                    setInquiryMemo(event.target.value);
                    setInquiryMessage(null);
                  }}
                  placeholder="다음에 어떻게 응대할지 짧게 적어 두세요."
                  value={inquiryMemo}
                />
              </label>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  className="btn-primary"
                  disabled={inquiryMutation.isPending || !selectedInquiryId}
                  onClick={() => inquiryMutation.mutate()}
                  type="button"
                >
                  응대 저장
                </button>
                {inquiryMessage ? <p className="text-sm font-semibold text-slate-600">{inquiryMessage}</p> : null}
              </div>
            </div>
          ) : (
            <EmptyState title="문의 한 건을 선택해 주세요" description="문의함에서 항목을 선택하면 상태, 태그, 메모를 바로 관리할 수 있습니다." />
          )}
        </Panel>
      </div>

      <div className="grid gap-8 xl:grid-cols-[0.96fr_1.04fr]">
        <Panel title="고객 목록" subtitle="단골 고객과 문의 리드를 한 화면에서 함께 찾을 수 있게 정리했습니다.">
          {customers.length ? (
            <div className="space-y-3">
              {customers.map((customer) => {
                const customerLabel = getCustomerDisplayLabel({
                  customer,
                  customerId: customer.id,
                });

                return (
                  <button
                    className={`w-full rounded-[28px] border p-4 text-left transition ${
                      selectedCustomer?.id === customer.id ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white'
                    }`}
                    key={customer.id}
                    onClick={() => {
                      setSelectedCustomerId(customer.id);
                      setCustomerForm({
                        id: customer.id,
                        name: customer.name,
                        phone: customer.phone,
                        email: customer.email || '',
                        marketing_opt_in: customer.marketing_opt_in,
                      });
                      setCustomerErrors({});
                      setCustomerMessage(null);
                    }}
                    type="button"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="font-bold">{customerLabel}</p>
                        <p className={`mt-1 text-sm ${selectedCustomer?.id === customer.id ? 'text-slate-200' : 'text-slate-500'}`}>{customer.phone || '전화번호 없음'}</p>
                      </div>
                      <div className="text-right">
                        {customer.is_regular ? <StatusBadge label="단골" status="ready" /> : null}
                        <p className={`mt-2 text-sm font-semibold ${selectedCustomer?.id === customer.id ? 'text-slate-200' : 'text-slate-500'}`}>
                          {customer.visit_count}회 방문
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <EmptyState title="아직 고객 정보가 없습니다" description="주문, 문의, 수기 등록으로 고객 정보가 생기면 이곳에서 바로 관리할 수 있습니다." />
          )}
        </Panel>

        <div className="space-y-8">
          <Panel title={customerForm.id ? '고객 정보 수정' : '고객 정보 등록'} subtitle="기존 흐름을 유지하면서도 점주가 수기로 고객 정보를 바로 정리할 수 있게 했습니다.">
            <div className="grid gap-4 sm:grid-cols-2">
              <label>
                <span className="field-label">이름</span>
                <input
                  className="input-base"
                  onChange={(event) => {
                    setCustomerForm((current) => ({ ...current, name: event.target.value }));
                    setCustomerErrors((current) => ({ ...current, name: undefined }));
                    setCustomerMessage(null);
                  }}
                  value={customerForm.name}
                />
                {customerErrors.name ? <p className="mt-2 text-sm text-rose-600">{customerErrors.name}</p> : null}
              </label>
              <label>
                <span className="field-label">전화번호</span>
                <input
                  className="input-base"
                  onChange={(event) => {
                    setCustomerForm((current) => ({ ...current, phone: event.target.value }));
                    setCustomerErrors((current) => ({ ...current, phone: undefined }));
                    setCustomerMessage(null);
                  }}
                  value={customerForm.phone}
                />
                {customerErrors.phone ? <p className="mt-2 text-sm text-rose-600">{customerErrors.phone}</p> : null}
              </label>
              <label className="sm:col-span-2">
                <span className="field-label">이메일</span>
                <input
                  className="input-base"
                  onChange={(event) => {
                    setCustomerForm((current) => ({ ...current, email: event.target.value }));
                    setCustomerErrors((current) => ({ ...current, email: undefined }));
                    setCustomerMessage(null);
                  }}
                  value={customerForm.email}
                />
                {customerErrors.email ? <p className="mt-2 text-sm text-rose-600">{customerErrors.email}</p> : null}
              </label>
            </div>

            <label className="mt-4 flex items-center gap-3 rounded-2xl bg-slate-50 p-4 text-sm font-semibold text-slate-700">
              <input
                checked={customerForm.marketing_opt_in}
                className="h-4 w-4 accent-orange-600"
                onChange={(event) => setCustomerForm((current) => ({ ...current, marketing_opt_in: event.target.checked }))}
                type="checkbox"
              />
              추후 안내 메시지 발송 허용
            </label>

            <div className="mt-4 flex flex-wrap gap-3">
              <button
                className="btn-primary"
                disabled={customerMutation.isPending}
                onClick={() => {
                  const parsed = customerContactSchema.safeParse(customerForm);
                  if (!parsed.success) {
                    const flattened = parsed.error.flatten().fieldErrors;
                    setCustomerErrors({
                      id: flattened.id?.[0],
                      name: flattened.name?.[0],
                      phone: flattened.phone?.[0],
                      email: flattened.email?.[0],
                      marketing_opt_in: flattened.marketing_opt_in?.[0],
                    });
                    setCustomerMessage('필수 고객 정보를 먼저 입력해 주세요.');
                    return;
                  }

                  setCustomerErrors({});
                  setCustomerMessage(null);
                  customerMutation.mutate();
                }}
                type="button"
              >
                고객 저장
              </button>
              <button
                className="btn-secondary"
                onClick={() => {
                  setCustomerForm(initialCustomerForm);
                  setSelectedCustomerId('');
                  setCustomerErrors({});
                  setCustomerMessage(null);
                }}
                type="button"
              >
                새 고객 등록
              </button>
              {customerMessage ? <p className="text-sm font-semibold text-slate-600">{customerMessage}</p> : null}
            </div>
          </Panel>

          <Panel title="최근 주문 맥락" subtitle="이 고객이 실제로 무엇을 주문했는지 바로 보여줘서 현장에서 곧바로 응대할 수 있게 합니다.">
            {selectedCustomer ? (
              <div className="space-y-3">
                <div className="rounded-[28px] border border-slate-200 bg-white p-5">
                  <p className="text-xl font-black text-slate-900">{selectedCustomerLabel}</p>
                  <p className="mt-2 text-sm text-slate-500">{selectedCustomer.phone || '전화번호 없음'}</p>
                  <p className="mt-2 text-sm text-slate-500">{selectedCustomer.email || '이메일이 아직 없습니다.'}</p>
                </div>

                {relatedOrders.length ? (
                  relatedOrders.map((order) => (
                    <div className="rounded-[28px] border border-slate-200 bg-white p-5" key={order.id}>
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <p className="font-bold text-slate-900">
                            {order.table_no ? `테이블 ${order.table_no}` : getOrderChannelLabel(order.channel)}
                          </p>
                          <p className="mt-2 text-sm leading-6 text-slate-500">{order.items.map((item) => `${item.menu_name} x${item.quantity}`).join(', ')}</p>
                          <p className="mt-2 text-xs text-slate-400">{formatDateTime(order.placed_at)}</p>
                        </div>
                        <div className="text-left sm:text-right">
                          <div className="flex flex-wrap gap-2 sm:justify-end">
                            <StatusBadge label={getOrderStatusLabel(order.status)} status={order.status} />
                            <StatusBadge label={getPaymentStatusLabel(order.payment_status)} status={order.payment_status} />
                          </div>
                          <p className="mt-2 text-sm font-semibold text-slate-700">{formatCurrency(order.total_amount)}</p>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-[28px] border border-dashed border-slate-200 bg-slate-50 p-5 text-sm text-slate-500">
                    아직 연결된 주문이 없습니다. 첫 방문 전 문의 고객도 여기서 먼저 관리할 수 있습니다.
                  </div>
                )}
              </div>
            ) : (
              <EmptyState title="고객을 선택해 주세요" description="고객이나 문의 리드를 선택하면 최근 주문과 연락 맥락을 바로 확인할 수 있습니다." />
            )}
          </Panel>

          <Panel title="AI 상담 / 고객 기억 맥락" subtitle="AI 상담과 공개 문의가 고객 메모리 축에 어떻게 쌓였는지 점주가 바로 확인할 수 있게 연결했습니다.">
            {selectedCustomer ? (
              <div className="space-y-4">
                {relatedConversationSessions.length ? (
                  <div className="grid gap-3 lg:grid-cols-[0.9fr_1.1fr]">
                    <div className="space-y-3">
                      {relatedConversationSessions.map((session) => (
                        <button
                          key={session.id}
                          className={`w-full rounded-[24px] border p-4 text-left transition ${
                            selectedConversationSession?.id === session.id ? 'border-orange-300 bg-orange-50' : 'border-slate-200 bg-white'
                          }`}
                          onClick={() => setSelectedConversationSessionId(session.id)}
                          type="button"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <p className="font-bold text-slate-900">{conversationChannelLabelMap[session.channel] || session.channel}</p>
                              <p className="mt-1 text-sm text-slate-500">{session.subject}</p>
                            </div>
                            <StatusBadge status={session.status} />
                          </div>
                          <p className="mt-3 text-xs text-slate-400">{formatDateTime(session.last_message_at || session.updated_at)}</p>
                        </button>
                      ))}
                    </div>

                    <div className="space-y-3">
                      {selectedConversationSession ? (
                        <div className="rounded-[28px] border border-slate-200 bg-white p-5">
                          <p className="text-sm font-semibold text-slate-500">대화 맥락</p>
                          <p className="mt-2 text-lg font-black text-slate-900">{selectedConversationSession.subject}</p>
                          <div className="mt-4 space-y-3">
                            {conversationMessages.map((message) => (
                              <div
                                key={message.id}
                                className={`rounded-2xl px-4 py-3 text-sm leading-7 ${
                                  message.sender === 'assistant'
                                    ? 'bg-slate-900 text-white'
                                    : 'border border-slate-200 bg-slate-50 text-slate-700'
                                }`}
                              >
                                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] opacity-70">
                                  {message.sender === 'assistant' ? 'AI 응답' : '고객 메시지'}
                                </p>
                                <p className="mt-2 whitespace-pre-wrap [word-break:keep-all]">{message.body}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : null}

                      <div className="rounded-[28px] border border-slate-200 bg-slate-50 p-5">
                        <p className="text-sm font-semibold text-slate-500">최근 고객 타임라인</p>
                        <div className="mt-3 space-y-3">
                          {customerTimeline.length ? (
                            customerTimeline.slice(0, 4).map((event) => (
                              <div key={event.id} className="rounded-2xl bg-white px-4 py-3 text-sm text-slate-700">
                                <p className="font-semibold text-slate-900">{event.summary}</p>
                                <p className="mt-1 text-xs text-slate-400">{formatDateTime(event.occurred_at)}</p>
                              </div>
                            ))
                          ) : (
                            <div className="rounded-2xl bg-white px-4 py-3 text-sm text-slate-500">
                              아직 연결된 상담/타임라인 기록이 없습니다.
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-[28px] border border-dashed border-slate-200 bg-slate-50 p-5 text-sm text-slate-500">
                    아직 연결된 상담 세션이 없습니다. 공개 AI 상담이나 공개 문의가 들어오면 이곳에서 고객 맥락과 함께 확인할 수 있습니다.
                  </div>
                )}
              </div>
            ) : (
              <EmptyState title="고객을 선택해 주세요" description="고객을 선택하면 AI 상담과 고객 타임라인을 함께 볼 수 있습니다." />
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}
