import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
  createColumnHelper,
  type SortingState,
} from '@tanstack/react-table';

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
import { buildCustomerTimelineIntelligenceDashboard, getCustomerIntelligenceCard } from '@/shared/lib/services/customerTimelineIntelligenceService';
import {
  buildVipDeliveryExecutionContract,
  buildVipDeliveryApprovalGatePlan,
  buildVipCampaignPreparationPreview,
  buildVipCustomerReadonlyView,
} from '@/shared/lib/services/vipCustomerReadonlyViewService';
import {
  getInquiryStatusLabel,
  getOrderChannelLabel,
  getOrderStatusLabel,
  getPaymentStatusLabel,
} from '@/shared/lib/merchantOperations';
import { getOrderItemSummary } from '@/shared/lib/orderItemsReadModel';
import { queryKeys } from '@/shared/lib/queryKeys';
import {
  listConversationMessages,
  listConversationSessions,
  listCustomerPreferences,
  listCustomerTimelineEvents,
  listCustomers,
  listInquiryInbox,
  listInquiries,
  listOrders,
  listReservations,
  listWaitingEntries,
  updateInquiryRecord,
  upsertCustomer,
} from '@/shared/lib/services/mvpService';
import { listSocialPublishJobs, listStoreBlogPosts, listStoreReviews } from '@/shared/lib/services/contentEngineService';

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

const vipReasonLabelMap: Record<string, string> = {
  explicit_vip_field: '명시 VIP 필드',
  lifetime_value_threshold: '누적 주문금액',
  order_count_threshold: '주문 횟수',
  segment_or_tag: '세그먼트/태그',
  visit_count_threshold: '방문 횟수',
};

// ─── TanStack Table: sortable customer list ───────────────────────────────────
type CustomerRow = {
  id: string; name: string; phone: string; email?: string;
  visit_count: number; last_visit_at?: string; is_regular: boolean;
};

const colHelper = createColumnHelper<CustomerRow>();

const customerColumns = [
  colHelper.accessor('name', {
    header: '고객명',
    cell: (info) => (
      <span className="font-semibold text-slate-900">{info.getValue() || '이름 없음'}</span>
    ),
  }),
  colHelper.accessor('phone', {
    header: '연락처',
    cell: (info) => <span className="text-slate-600">{info.getValue() || '—'}</span>,
  }),
  colHelper.accessor('visit_count', {
    header: () => <span className="flex items-center gap-1">방문 횟수 <span className="text-[10px] text-slate-400">↕</span></span>,
    cell: (info) => (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-bold text-slate-700">
        {info.getValue()}회
      </span>
    ),
  }),
  colHelper.accessor('is_regular', {
    header: '단골',
    cell: (info) => info.getValue()
      ? <span className="rounded-full bg-orange-100 px-2.5 py-0.5 text-xs font-bold text-orange-700">단골</span>
      : <span className="text-slate-300">—</span>,
  }),
  colHelper.accessor('last_visit_at', {
    header: '최근 방문',
    cell: (info) => {
      const v = info.getValue();
      return <span className="text-xs text-slate-500">{v ? new Date(v).toLocaleDateString('ko-KR') : '—'}</span>;
    },
  }),
];

function CustomerDataTable({ data }: { data: CustomerRow[] }) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState('');

  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data,
    columns: customerColumns,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  return (
    <div className="space-y-3">
      <input
        className="input-base max-w-xs"
        placeholder="고객명 · 연락처 검색..."
        value={globalFilter}
        onChange={(e) => setGlobalFilter(e.target.value)}
      />
      <div className="overflow-x-auto rounded-2xl border border-slate-200">
        <table className="w-full text-sm">
          <thead>
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id} className="border-b border-slate-200 bg-slate-50">
                {hg.headers.map((header) => (
                  <th
                    key={header.id}
                    className="px-4 py-3 text-left text-xs font-black uppercase tracking-wider text-slate-500"
                    onClick={header.column.getToggleSortingHandler()}
                    style={{ cursor: header.column.getCanSort() ? 'pointer' : 'default' }}
                  >
                    {flexRender(header.column.columnDef.header, header.getContext())}
                    {header.column.getIsSorted() === 'asc' ? ' ↑' : header.column.getIsSorted() === 'desc' ? ' ↓' : ''}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.length === 0 ? (
              <tr>
                <td colSpan={customerColumns.length} className="py-8 text-center text-sm text-slate-400">
                  고객 데이터가 없습니다
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <tr key={row.id} className="border-b border-slate-100 hover:bg-orange-50/40 transition-colors">
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-4 py-3">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-slate-400">{table.getFilteredRowModel().rows.length}명 표시 중</p>
    </div>
  );
}

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
  const [inboxStatusFilter, setInboxStatusFilter] = useState<'all' | (typeof inquiryStatusValues)[number]>('all');
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

  const inquiryInboxQuery = useQuery({
    queryKey: queryKeys.inquiryInbox(currentStore?.id || '', inboxStatusFilter),
    queryFn: () =>
      listInquiryInbox(
        currentStore!.id,
        inboxStatusFilter === 'all' ? undefined : inboxStatusFilter,
      ),
    enabled: Boolean(currentStore),
  });

  const conversationSessionsQuery = useQuery({
    queryKey: queryKeys.conversationSessions(currentStore?.id || ''),
    queryFn: () => listConversationSessions(currentStore!.id),
    enabled: Boolean(currentStore),
  });

  const customerPreferencesQuery = useQuery({
    queryKey: queryKeys.customerPreferences(currentStore?.id || ''),
    queryFn: () => listCustomerPreferences(currentStore!.id),
    enabled: Boolean(currentStore),
  });

  const reservationsQuery = useQuery({
    queryKey: queryKeys.reservations(currentStore?.id || ''),
    queryFn: () => listReservations(currentStore!.id),
    enabled: Boolean(currentStore),
  });

  const waitingQuery = useQuery({
    queryKey: queryKeys.waiting(currentStore?.id || ''),
    queryFn: () => listWaitingEntries(currentStore!.id),
    enabled: Boolean(currentStore),
  });

  const reviewsQuery = useQuery({
    queryKey: queryKeys.contentReviews(currentStore?.id || '', 'all'),
    queryFn: () => listStoreReviews(currentStore!.id),
    enabled: Boolean(currentStore),
  });

  const blogPostsQuery = useQuery({
    queryKey: queryKeys.contentBlog(currentStore?.id || '', 'all'),
    queryFn: () => listStoreBlogPosts(currentStore!.id),
    enabled: Boolean(currentStore),
  });

  const socialJobsQuery = useQuery({
    queryKey: [...queryKeys.contentSocial(currentStore?.id || ''), 'jobs'],
    queryFn: () => listSocialPublishJobs(currentStore!.id),
    enabled: Boolean(currentStore),
  });

  const customerMutation = useMutation({
    mutationFn: () => upsertCustomer(currentStore!.id, customerForm),
    onSuccess: async () => {
      setCustomerMessage('고객 정보를 저장했습니다.');
      setCustomerErrors({});
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.customers(currentStore!.id) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.customerPreferences(currentStore!.id) }),
      ]);
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
  const inquiryInbox = inquiryInboxQuery.data;
  const conversationSessions = conversationSessionsQuery.data || [];
  const customerPreferences = customerPreferencesQuery.data || [];
  const reservations = reservationsQuery.data || [];
  const waitingEntries = waitingQuery.data || [];
  const reviews = reviewsQuery.data || [];
  const blogPosts = blogPostsQuery.data || [];
  const socialJobs = socialJobsQuery.data || [];

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
  const intelligenceDashboard = buildCustomerTimelineIntelligenceDashboard({
    blogPosts,
    customers,
    inquiries,
    orders,
    preferences: customerPreferences,
    reservations,
    reviews,
    socialJobs,
    storeId: currentStore?.id || '',
    timelineEvents: customerTimeline,
    waitingEntries,
  });
  const vipReadonlyView = buildVipCustomerReadonlyView({
    customers,
    orders,
    preferences: customerPreferences,
    storeId: currentStore?.id || '',
    storeSubscriptionPlan: currentStore?.subscription_plan,
    timelineEvents: customerTimeline,
  });
  const vipCampaignPreview = buildVipCampaignPreparationPreview({
    customers,
    orders,
    preferences: customerPreferences,
    storeId: currentStore?.id || '',
    storeSubscriptionPlan: currentStore?.subscription_plan,
    timelineEvents: customerTimeline,
  });
  const vipDeliveryApprovalGatePlan = buildVipDeliveryApprovalGatePlan();
  const vipDeliveryExecutionContract = buildVipDeliveryExecutionContract();
  const selectedCustomerInsight = getCustomerIntelligenceCard(intelligenceDashboard, selectedCustomer?.id);
  const selectedIntelligenceTimeline = selectedCustomerInsight?.timeline || [];

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

      <Panel
        title="VIP Customer Memory"
        subtitle="방문, 주문, 문의, 예약, 선호 신호로만 계산한 read-only VIP 고객 후보를 마스킹된 정보와 집계 요약으로 확인합니다."
      >
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-600">
          {vipReadonlyView.readOnlyNotice}
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl bg-slate-50 p-4">
            <p className="text-xs font-bold text-slate-500">검토 고객</p>
            <p className="mt-1 text-2xl font-black text-slate-900">{vipReadonlyView.summary.totalCustomersReviewed}</p>
          </div>
          <div className="rounded-2xl bg-slate-50 p-4">
            <p className="text-xs font-bold text-slate-500">VIP 후보</p>
            <p className="mt-1 text-2xl font-black text-orange-600">{vipReadonlyView.summary.vipCustomerCount}</p>
          </div>
          <div className="rounded-2xl bg-slate-50 p-4">
            <p className="text-xs font-bold text-slate-500">구독 플랜 연동</p>
            <p className="mt-1 text-sm font-bold text-slate-700">
              고객 VIP 판단에는 사용하지 않음
            </p>
          </div>
        </div>

        {customersQuery.isLoading || ordersQuery.isLoading || customerPreferencesQuery.isLoading ? (
          <div className="mt-5 rounded-[24px] border border-slate-200 bg-white p-5 text-sm font-semibold text-slate-500">
            VIP 고객 메모리 요약을 불러오는 중입니다.
          </div>
        ) : vipReadonlyView.vipCustomers.length ? (
          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            {vipReadonlyView.vipCustomers.slice(0, 6).map((vipCustomer) => (
              <div className="rounded-[28px] border border-slate-200 bg-white p-5" key={vipCustomer.customerId}>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.14em] text-orange-600">VIP 후보</p>
                    <p className="mt-2 text-xl font-black text-slate-900">{vipCustomer.maskedDisplayName}</p>
                    <p className="mt-1 text-sm font-semibold text-slate-500">{vipCustomer.maskedContact}</p>
                  </div>
                  <StatusBadge label="read-only" status="ready" />
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl bg-slate-50 p-3">
                    <p className="text-[11px] font-bold text-slate-500">방문</p>
                    <p className="mt-1 font-black text-slate-900">{vipCustomer.totalVisitCount}</p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-3">
                    <p className="text-[11px] font-bold text-slate-500">주문</p>
                    <p className="mt-1 font-black text-slate-900">{vipCustomer.orderCount}</p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-3">
                    <p className="text-[11px] font-bold text-slate-500">누적</p>
                    <p className="mt-1 font-black text-slate-900">{formatCurrency(vipCustomer.totalOrderAmount)}</p>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {vipCustomer.vipReasons.map((reason) => (
                    <span className="rounded-full bg-orange-100 px-3 py-1 text-xs font-bold text-orange-700" key={reason}>
                      {vipReasonLabelMap[reason] || reason}
                    </span>
                  ))}
                </div>
                <div className="mt-4 space-y-2 text-sm leading-6 text-slate-600">
                  <p>
                    <span className="font-bold text-slate-800">최근 이벤트:</span> {vipCustomer.recentEventSummary}
                  </p>
                  <p>
                    <span className="font-bold text-slate-800">선호/메모 요약:</span> {vipCustomer.preferenceSummary}
                  </p>
                  <p>
                    <span className="font-bold text-slate-800">다음 액션:</span> {vipCustomer.expectedNextAction}
                  </p>
                  {vipCustomer.lastActivityAt ? (
                    <p className="text-xs text-slate-400">최근 활동 {formatDateTime(vipCustomer.lastActivityAt)}</p>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            title={vipReadonlyView.emptyState.title}
            description={vipReadonlyView.emptyState.description}
          />
        )}

        <div className="mt-6 rounded-[28px] border border-slate-200 bg-white p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-orange-600">preview-only</p>
              <h3 className="mt-2 text-xl font-black text-slate-900">캠페인 준비 미리보기</h3>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                확인 전용입니다. 발송 전 승인 필요. SMS/Kakao/Email delivery is not executed here.
                고객 등급과 메모는 변경되지 않습니다.
              </p>
              <div className="mt-3 rounded-2xl border border-orange-100 bg-orange-50 px-4 py-3 text-xs font-semibold leading-5 text-orange-800">
                별도 승인 게이트 필요. 마케팅 동의, 대상자 수, 메시지 초안 검토 후 별도 승인 필요.
                SMS/Kakao/Email 연동은 future approval scope입니다.
                deliveryExecutionEnabled={String(vipDeliveryApprovalGatePlan.deliveryExecutionEnabled)}.
              </div>
              <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs font-semibold leading-5 text-slate-700">
                Delivery execution contract required. This screen does not deliver messages. Marketing consent,
                final recipient count, message body review, cost approval, duplicate prevention, audit log,
                failure handling, and rollback policy must be approved before future SMS/Kakao/Email scope.
                providerIntegrationEnabled={String(vipDeliveryExecutionContract.providerIntegrationEnabled)};
                allowedChannels={vipDeliveryExecutionContract.allowedChannels.length}.
              </div>
            </div>
            <StatusBadge label="read-only" status="ready" />
          </div>
          <div className="mt-5 grid gap-4 lg:grid-cols-3">
            {vipCampaignPreview.sections.map((section) => (
              <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4" key={section.section}>
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-black text-slate-900">{section.title}</p>
                  <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-600">
                    {section.candidateCount}명
                  </span>
                </div>
                <p className="mt-3 text-xs leading-5 text-slate-500">{section.purpose}</p>
                <div className="mt-3 space-y-2">
                  {section.maskedCandidates.slice(0, 3).map((candidate) => (
                    <div className="rounded-2xl bg-white px-3 py-2 text-xs text-slate-600" key={candidate.customerId}>
                      <p className="font-bold text-slate-800">{candidate.maskedDisplayName}</p>
                      <p>{candidate.recommendedReason}</p>
                    </div>
                  ))}
                </div>
                <p className="mt-3 rounded-2xl bg-white px-3 py-2 text-xs leading-5 text-slate-500">
                  {section.suggestedMessageDraft}
                </p>
                <p className="mt-3 text-[11px] font-semibold leading-5 text-slate-500">
                  {section.cautionText} 발송 기능은 별도 승인 후 확장합니다.
                </p>
              </div>
            ))}
          </div>
        </div>
      </Panel>

      <Panel title="문의 Inbox" subtitle="공개 문의를 고객 기억, 연락 채널, 최근 타임라인과 함께 읽기 전용으로 확인합니다.">
        <div className="flex flex-wrap gap-2">
          <button
            className={`rounded-full px-4 py-2 text-sm font-bold transition ${
              inboxStatusFilter === 'all' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'
            }`}
            onClick={() => setInboxStatusFilter('all')}
            type="button"
          >
            전체
          </button>
          {inquiryStatusOptions.map((option) => (
            <button
              className={`rounded-full px-4 py-2 text-sm font-bold transition ${
                inboxStatusFilter === option.value ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'
              }`}
              key={option.value}
              onClick={() => setInboxStatusFilter(option.value)}
              type="button"
            >
              {getInquiryStatusLabel(option.value)}
            </button>
          ))}
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-4">
          <div>
            <p className="text-xs font-bold text-slate-500">Inbox</p>
            <p className="mt-1 text-2xl font-black text-slate-900">{inquiryInbox?.counts.total || 0}</p>
          </div>
          <div>
            <p className="text-xs font-bold text-slate-500">후속 필요</p>
            <p className="mt-1 text-2xl font-black text-orange-600">{inquiryInbox?.counts.needsFollowUp || 0}</p>
          </div>
          <div>
            <p className="text-xs font-bold text-slate-500">고객 연결</p>
            <p className="mt-1 text-2xl font-black text-emerald-600">{inquiryInbox?.counts.linked || 0}</p>
          </div>
          <div>
            <p className="text-xs font-bold text-slate-500">미연결</p>
            <p className="mt-1 text-2xl font-black text-slate-500">{inquiryInbox?.counts.unlinked || 0}</p>
          </div>
        </div>

        {inquiryInboxQuery.isLoading ? (
          <div className="mt-5 border-t border-slate-100 pt-5 text-sm font-semibold text-slate-500">
            문의 Inbox를 불러오는 중입니다.
          </div>
        ) : inquiryInbox?.items.length ? (
          <div className="mt-5 divide-y divide-slate-100 border-t border-slate-100">
            {inquiryInbox.items.slice(0, 8).map((item) => (
              <div className="grid gap-4 py-4 lg:grid-cols-[1fr_0.7fr_0.8fr_auto]" key={item.id}>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge label={getInquiryStatusLabel(item.status)} status={item.status} />
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
                      {item.category}
                    </span>
                    {item.needsFollowUp ? (
                      <span className="rounded-full bg-orange-100 px-3 py-1 text-xs font-bold text-orange-700">
                        후속 필요
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-2 font-black text-slate-900">{item.subject}</p>
                  <p className="mt-1 text-sm leading-6 text-slate-500">{item.summary}</p>
                  <p className="mt-1 text-xs text-slate-400">{formatDateTime(item.createdAt)}</p>
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-500">고객</p>
                  <p className="mt-1 font-bold text-slate-900">{item.maskedCustomerDisplayName}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {item.customerLinked ? '고객 기억 연결됨' : '고객 기억 미연결'}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-500">연락 / 최근 타임라인</p>
                  <p className="mt-1 text-sm font-semibold text-slate-700">{item.maskedContactChannel}</p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">{item.latestTimelineEventSummary}</p>
                </div>
                <div className="flex items-start lg:justify-end">
                  <button className="btn-secondary" disabled type="button">
                    상태 변경은 다음 PR
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            title="읽기 전용 문의 Inbox가 비어 있습니다"
            description="공개 문의가 들어오면 고객 기억 연결, masked 연락 채널, 최근 타임라인 요약이 이 영역에 표시됩니다."
          />
        )}
      </Panel>

      {/* TanStack Table: sortable & filterable customer list */}
      <Panel title="고객 목록" subtitle="이름·방문 횟수로 정렬하고 이름·연락처로 빠르게 검색합니다.">
        <CustomerDataTable data={customers as CustomerRow[]} />
      </Panel>

      <Panel title="고객 타임라인 인텔리전스" subtitle="주문, 문의, 예약, 웨이팅, 리뷰를 고객 기억 카드로 묶어 다음 행동 후보를 보여줍니다.">
        {intelligenceDashboard.cards.length ? (
          <div className="grid gap-4 xl:grid-cols-3">
            {intelligenceDashboard.cards.slice(0, 6).map((card) => (
              <button
                className={`rounded-[28px] border p-5 text-left transition ${
                  selectedCustomer?.id === card.customerId ? 'border-orange-300 bg-orange-50' : 'border-slate-200 bg-white'
                }`}
                key={card.customerId}
                onClick={() => setSelectedCustomerId(card.customerId)}
                type="button"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-bold text-slate-900">{card.displayLabel}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      최근 행동 {card.lastActivityAt ? formatDateTime(card.lastActivityAt) : '데이터 없음'}
                    </p>
                  </div>
                  <span className="rounded-full bg-slate-900 px-3 py-1 text-xs font-bold text-white">
                    {card.counts.orders}회 주문
                  </span>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {card.statusBadges.slice(0, 3).map((badge) => (
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700" key={`${card.customerId}-${badge.status}`}>
                      {badge.label}
                    </span>
                  ))}
                </div>
                <div className="mt-4 grid gap-2 text-sm text-slate-600">
                  <p>평균 객단가 {formatCurrency(card.averageOrderAmount)}</p>
                  <p>최근 품목 {card.recentOrderItemSummary}</p>
                  <p>자주 주문 {card.frequentItems[0]?.menuName || '데이터 없음'}</p>
                </div>
                <div className="mt-4 rounded-2xl bg-slate-50 p-3">
                  <p className="text-xs font-bold text-slate-500">다음 추천 액션</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">{card.nextActions[0]?.label}</p>
                  <p className="mt-1 text-xs text-slate-500">{card.nextActions[0]?.disabledReason || '이 기능은 다음 배포에서 제공됩니다.'}</p>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <EmptyState
            title="고객 기억 카드가 아직 없습니다"
            description="문의, 주문, 예약, 웨이팅, 리뷰가 고객과 연결되면 이 영역에서 다음 행동 후보를 볼 수 있습니다."
          />
        )}
      </Panel>

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

          <Panel title="고객 인텔리전스 상세" subtitle="선택한 고객의 행동 요약과 다음 추천 액션을 안전한 내부 운영 정보로만 보여줍니다.">
            {selectedCustomerInsight ? (
              <div className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <p className="text-xs font-bold text-slate-500">총 주문금액</p>
                    <p className="mt-1 text-lg font-black text-slate-900">{formatCurrency(selectedCustomerInsight.totalOrderAmount)}</p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <p className="text-xs font-bold text-slate-500">평균 객단가</p>
                    <p className="mt-1 text-lg font-black text-slate-900">{formatCurrency(selectedCustomerInsight.averageOrderAmount)}</p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <p className="text-xs font-bold text-slate-500">품목 수량</p>
                    <p className="mt-1 text-lg font-black text-slate-900">{selectedCustomerInsight.totalItemQuantity}</p>
                  </div>
                </div>
                <div className="rounded-[28px] border border-slate-200 bg-white p-5">
                  <p className="text-sm font-semibold text-slate-500">추천 액션</p>
                  <div className="mt-3 space-y-3">
                    {selectedCustomerInsight.nextActions.slice(0, 3).map((action) => (
                      <div className="rounded-2xl bg-slate-50 p-4" key={action.id}>
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <p className="font-bold text-slate-900">{action.label}</p>
                            <p className="mt-1 text-sm leading-6 text-slate-500">{action.description}</p>
                          </div>
                          <button className="btn-secondary" disabled type="button">
                            이 기능은 다음 배포에서 제공됩니다.
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                {selectedCustomerInsight.tags.length ? (
                  <div className="flex flex-wrap gap-2">
                    {selectedCustomerInsight.tags.map((tag) => (
                      <span className="rounded-full bg-orange-100 px-3 py-1 text-xs font-semibold text-orange-700" key={`${selectedCustomerInsight.customerId}-${tag}`}>
                        {tag}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : (
              <EmptyState title="고객 인텔리전스가 아직 없습니다" description="고객을 선택하면 주문, 리뷰, 문의 기반의 다음 행동 후보가 표시됩니다." />
            )}
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
                          <p className="mt-2 text-sm leading-6 text-slate-500">{getOrderItemSummary(order.items)}</p>
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
                          {selectedIntelligenceTimeline.length ? (
                            selectedIntelligenceTimeline.slice(0, 6).map((event) => (
                              <div key={event.id} className="rounded-2xl bg-white px-4 py-3 text-sm text-slate-700">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-bold text-slate-600">{event.label}</span>
                                  <span className="rounded-full bg-orange-100 px-2 py-1 text-[11px] font-bold text-orange-700">{event.sourceBadge}</span>
                                </div>
                                <p className="mt-2 font-semibold text-slate-900">{event.summary}</p>
                                {event.orderItemSummary ? <p className="mt-1 text-xs text-slate-500">{event.orderItemSummary}</p> : null}
                                <p className="mt-1 text-xs text-slate-400">{formatDateTime(event.occurredAt)}</p>
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
