import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { EmptyState } from '@/shared/components/EmptyState';
import { MetricCard } from '@/shared/components/MetricCard';
import { PageHeader } from '@/shared/components/PageHeader';
import { Panel } from '@/shared/components/Panel';
import { StatusBadge } from '@/shared/components/StatusBadge';
import { useCurrentStore } from '@/shared/hooks/useCurrentStore';
import { usePageMeta } from '@/shared/hooks/usePageMeta';
import { customerContactSchema, inquiryStatusValues, normalizeInquiryTags } from '@/shared/lib/inquirySchema';
import { formatCurrency, formatDateTime } from '@/shared/lib/format';
import { queryKeys } from '@/shared/lib/queryKeys';
import { listCustomers, listInquiries, listOrders, updateInquiryRecord, upsertCustomer } from '@/shared/lib/services/mvpService';

const initialCustomerForm = {
  id: '',
  name: '',
  phone: '',
  email: '',
  marketing_opt_in: false,
};

const inquiryStatusOptions: Array<{ label: string; value: (typeof inquiryStatusValues)[number] }> = [
  { label: 'New', value: 'new' },
  { label: 'In progress', value: 'in_progress' },
  { label: 'Completed', value: 'completed' },
  { label: 'On hold', value: 'on_hold' },
];

const inquiryCategoryLabelMap: Record<string, string> = {
  general: 'General',
  reservation: 'Reservation',
  group_booking: 'Group booking',
  event: 'Event',
  brand: 'Brand',
};

const orderChannelLabelMap: Record<string, string> = {
  delivery: 'Delivery',
  reservation: 'Reservation order',
  table: 'Table order',
  walk_in: 'Walk-in',
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

  usePageMeta('CRM and inquiries', 'A simple owner CRM screen with inquiry inbox, follow-up state, customer records, and order context.');

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

  const customerMutation = useMutation({
    mutationFn: () => upsertCustomer(currentStore!.id, customerForm),
    onSuccess: async () => {
      setCustomerMessage('Customer record saved.');
      setCustomerErrors({});
      await queryClient.invalidateQueries({ queryKey: queryKeys.customers(currentStore!.id) });
    },
    onError: (error) => {
      setCustomerMessage(error instanceof Error ? error.message : 'Customer record could not be saved.');
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
      setInquiryMessage('Inquiry follow-up updated.');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.inquiries(currentStore!.id) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.publicInquiry(currentStore!.id) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.publicStoreById(currentStore!.id) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.dashboard(currentStore!.id) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.aiReports(currentStore!.id) }),
      ]);
    },
    onError: (error) => {
      setInquiryMessage(error instanceof Error ? error.message : 'Inquiry update failed.');
    },
  });

  const customers = customersQuery.data || [];
  const orders = ordersQuery.data || [];
  const inquiries = inquiriesQuery.data || [];

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
  const relatedOrders = orders.filter((order) => order.customer?.id === selectedCustomer?.id);
  const openInquiryCount = inquiries.filter((inquiry) => inquiry.status !== 'completed').length;
  const regularCustomerCount = customers.filter((customer) => customer.is_regular).length;

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
        title="CRM is preparing"
        description="Store selection is still loading. Open this screen again once a store is active."
      />
    );
  }

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Owner CRM"
        title="CRM and inquiry inbox"
        description="Keep leads, repeat guests, follow-up memo, and recent order context in one simple owner screen."
      />

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard accent="blue" label="Customers" value={customers.length} />
        <MetricCard accent="emerald" label="Regulars" value={regularCustomerCount} />
        <MetricCard accent="orange" label="Open inquiries" value={openInquiryCount} />
        <MetricCard accent="slate" label="Recent leads" value={inquiries.length} />
      </div>

      <div className="grid gap-8 xl:grid-cols-[1.02fr_0.98fr]">
        <Panel title="Inquiry inbox" subtitle="A simple list the owner can scan from top to bottom.">
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
                        <p className="font-bold text-slate-900">{inquiry.customer_name}</p>
                        <StatusBadge status={inquiry.status} />
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
            <EmptyState title="No inquiries yet" description="Public inquiry submissions will appear here as soon as the first lead is captured." />
          )}
        </Panel>

        <Panel title="Inquiry follow-up" subtitle="Status, tags, and memo stay short so the owner can update them quickly on mobile too.">
          {selectedInquiry ? (
            <div className="space-y-5">
              <div className="rounded-[28px] border border-slate-200 bg-white p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-xl font-black text-slate-900">{selectedInquiry.customer_name}</p>
                  <StatusBadge status={selectedInquiry.status} />
                </div>
                <p className="mt-3 text-sm leading-7 text-slate-600">{selectedInquiry.message}</p>
                <div className="mt-4 grid gap-3 text-sm text-slate-500 sm:grid-cols-2">
                  <p>
                    <span className="font-semibold text-slate-900">Phone</span>
                    <br />
                    {selectedInquiry.phone}
                  </p>
                  <p>
                    <span className="font-semibold text-slate-900">Email</span>
                    <br />
                    {selectedInquiry.email || '-'}
                  </p>
                  <p>
                    <span className="font-semibold text-slate-900">Requested date</span>
                    <br />
                    {selectedInquiry.requested_visit_date || '-'}
                  </p>
                  <p>
                    <span className="font-semibold text-slate-900">Source</span>
                    <br />
                    {selectedInquiry.source === 'public_form' ? 'Public store form' : 'Owner manual'}
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
                <span className="field-label">Tags</span>
                <input
                  className="input-base"
                  onChange={(event) => {
                    setInquiryTagsText(event.target.value);
                    setInquiryMessage(null);
                  }}
                  placeholder="VIP, dinner, callback"
                  value={inquiryTagsText}
                />
              </label>

              <label>
                <span className="field-label">Owner memo</span>
                <textarea
                  className="input-base min-h-28"
                  onChange={(event) => {
                    setInquiryMemo(event.target.value);
                    setInquiryMessage(null);
                  }}
                  placeholder="Keep a short next-step note for the owner team."
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
                  Save follow-up
                </button>
                {inquiryMessage ? <p className="text-sm font-semibold text-slate-600">{inquiryMessage}</p> : null}
              </div>
            </div>
          ) : (
            <EmptyState title="Select an inquiry" description="Choose an inquiry from the inbox to manage status, tags, and memo." />
          )}
        </Panel>
      </div>

      <div className="grid gap-8 xl:grid-cols-[0.96fr_1.04fr]">
        <Panel title="Customer list" subtitle="Repeat guests and lead contacts stay searchable in the same screen.">
          {customers.length ? (
            <div className="space-y-3">
              {customers.map((customer) => (
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
                      <p className="font-bold">{customer.name}</p>
                      <p className={`mt-1 text-sm ${selectedCustomer?.id === customer.id ? 'text-slate-200' : 'text-slate-500'}`}>{customer.phone}</p>
                    </div>
                    <div className="text-right">
                      {customer.is_regular ? <StatusBadge status="ready" /> : null}
                      <p className={`mt-2 text-sm font-semibold ${selectedCustomer?.id === customer.id ? 'text-slate-200' : 'text-slate-500'}`}>
                        {customer.visit_count} visits
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <EmptyState title="No customers yet" description="Customer records will appear from orders, inquiry leads, or manual owner entry." />
          )}
        </Panel>

        <div className="space-y-8">
          <Panel title={customerForm.id ? 'Edit customer' : 'Create customer'} subtitle="Keep the manual customer editor available so existing flows stay intact.">
            <div className="grid gap-4 sm:grid-cols-2">
              <label>
                <span className="field-label">Name</span>
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
                <span className="field-label">Phone</span>
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
                <span className="field-label">Email</span>
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
              Allow follow-up message
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
                    setCustomerMessage('Please complete the required customer fields.');
                    return;
                  }

                  setCustomerErrors({});
                  setCustomerMessage(null);
                  customerMutation.mutate();
                }}
                type="button"
              >
                Save customer
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
                New record
              </button>
              {customerMessage ? <p className="text-sm font-semibold text-slate-600">{customerMessage}</p> : null}
            </div>
          </Panel>

          <Panel title="Recent order context" subtitle="Show what this customer actually bought so the owner can answer on the spot.">
            {selectedCustomer ? (
              <div className="space-y-3">
                <div className="rounded-[28px] border border-slate-200 bg-white p-5">
                  <p className="text-xl font-black text-slate-900">{selectedCustomer.name}</p>
                  <p className="mt-2 text-sm text-slate-500">{selectedCustomer.phone}</p>
                  <p className="mt-2 text-sm text-slate-500">{selectedCustomer.email || 'No email saved yet.'}</p>
                </div>

                {relatedOrders.length ? (
                  relatedOrders.map((order) => (
                    <div className="rounded-[28px] border border-slate-200 bg-white p-5" key={order.id}>
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <p className="font-bold text-slate-900">
                            {order.table_no ? `Table ${order.table_no}` : orderChannelLabelMap[order.channel] || order.channel}
                          </p>
                          <p className="mt-2 text-sm leading-6 text-slate-500">{order.items.map((item) => `${item.menu_name} x${item.quantity}`).join(', ')}</p>
                          <p className="mt-2 text-xs text-slate-400">{formatDateTime(order.placed_at)}</p>
                        </div>
                        <div className="text-left sm:text-right">
                          <StatusBadge status={order.status} />
                          <p className="mt-2 text-sm font-semibold text-slate-700">{formatCurrency(order.total_amount)}</p>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-[28px] border border-dashed border-slate-200 bg-slate-50 p-5 text-sm text-slate-500">
                    No linked order yet. Inquiry-led customers can still be managed before their first visit.
                  </div>
                )}
              </div>
            ) : (
              <EmptyState title="Select a customer" description="Choose a customer or inquiry-linked lead to see recent orders and contact context." />
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}
