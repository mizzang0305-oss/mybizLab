import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';

import { EmptyState } from '@/shared/components/EmptyState';
import { usePageMeta } from '@/shared/hooks/usePageMeta';
import { publicInquirySchema, type PublicInquiryFormInput } from '@/shared/lib/inquirySchema';
import { queryKeys } from '@/shared/lib/queryKeys';
import { getPublicInquiryForm, submitPublicInquiry } from '@/shared/lib/services/mvpService';
import { buildStoreIdPath } from '@/shared/lib/storeSlug';

const categoryOptions: Array<{ label: string; value: PublicInquiryFormInput['category']; hint: string }> = [
  { label: 'General', value: 'general', hint: 'Simple question or contact request' },
  { label: 'Reservation', value: 'reservation', hint: 'Seat, time, or booking question' },
  { label: 'Group', value: 'group_booking', hint: 'Team dinner or larger party' },
  { label: 'Event', value: 'event', hint: 'Private event or special day' },
  { label: 'Brand', value: 'brand', hint: 'Partnership, catering, or brand request' },
];

const initialForm: PublicInquiryFormInput = {
  customerName: '',
  phone: '',
  email: '',
  category: 'general',
  requestedVisitDate: '',
  message: '',
  marketingOptIn: false,
};

export function PublicInquiryPage() {
  const { storeId = '' } = useParams<{ storeId: string }>();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<PublicInquiryFormInput>(initialForm);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof PublicInquiryFormInput, string>>>({});
  const [submitMessage, setSubmitMessage] = useState<string | null>(null);

  const inquiryQuery = useQuery({
    queryKey: queryKeys.publicInquiry(storeId),
    queryFn: () => getPublicInquiryForm(storeId),
    enabled: Boolean(storeId),
  });

  const storeName = inquiryQuery.data?.store.name || 'Store inquiry';
  usePageMeta(`${storeName} inquiry`, 'A mobile-friendly inquiry route for consultation, reservation, and branded lead capture.');

  const submitMutation = useMutation({
    mutationFn: (input: PublicInquiryFormInput) =>
      submitPublicInquiry({
        ...input,
        storeId,
        marketingOptIn: input.marketingOptIn ?? false,
      }),
    onSuccess: async () => {
      setSubmitMessage('The inquiry was saved and is now visible in CRM, dashboard follow-up, and public store summary.');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.publicInquiry(storeId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.publicStoreById(storeId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.inquiries(storeId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.customers(storeId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.dashboard(storeId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.aiReports(storeId) }),
        queryClient.invalidateQueries({ queryKey: ['ai-reports-dashboard', storeId] }),
        queryClient.invalidateQueries({ queryKey: queryKeys.operationsMetrics(storeId) }),
      ]);
    },
    onError: (error) => {
      setSubmitMessage(error instanceof Error ? error.message : 'The inquiry could not be submitted.');
    },
  });

  if (inquiryQuery.isLoading) {
    return (
      <div className="page-shell py-16">
        <div className="rounded-[32px] border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">Loading inquiry form...</div>
      </div>
    );
  }

  if (!inquiryQuery.data) {
    return (
      <div className="page-shell py-16">
        <EmptyState
          action={
            <Link className="btn-primary" to="/">
              Go home
            </Link>
          }
          description="The inquiry route could not be found for this store."
          title="Inquiry form not found"
        />
      </div>
    );
  }

  const { store, summary } = inquiryQuery.data;
  const homePath = buildStoreIdPath(store.id);

  if (submitMutation.isSuccess && submitMessage) {
    const updatedSummary = submitMutation.data?.summary || summary;

    return (
      <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#ecfeff,_#ffffff_58%)] px-4 py-10 sm:px-6">
        <div className="mx-auto max-w-xl space-y-6">
          <div className="rounded-[36px] bg-slate-950 px-6 py-8 text-white shadow-[0_35px_90px_-45px_rgba(15,23,42,0.85)]">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-200">{store.name}</p>
            <h1 className="mt-3 text-3xl font-black">Inquiry received</h1>
            <p className="mt-3 text-sm leading-7 text-slate-200">{submitMessage}</p>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-[28px] border border-slate-200 bg-white p-5">
              <p className="text-sm font-semibold text-slate-500">Total leads</p>
              <p className="mt-2 text-3xl font-black text-slate-900">{updatedSummary.totalCount}</p>
            </div>
            <div className="rounded-[28px] border border-slate-200 bg-white p-5">
              <p className="text-sm font-semibold text-slate-500">Open follow-up</p>
              <p className="mt-2 text-3xl font-black text-slate-900">{updatedSummary.openCount}</p>
            </div>
            <div className="rounded-[28px] border border-slate-200 bg-white p-5">
              <p className="text-sm font-semibold text-slate-500">Category</p>
              <p className="mt-2 text-lg font-semibold text-slate-900">
                {categoryOptions.find((option) => option.value === form.category)?.label || form.category}
              </p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Link className="btn-primary justify-center" to={homePath}>
              Back to store
            </Link>
            <button
              className="btn-secondary justify-center"
              onClick={() => {
                setForm(initialForm);
                setFieldErrors({});
                setSubmitMessage(null);
                submitMutation.reset();
              }}
              type="button"
            >
              Submit another inquiry
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#ecfeff,_#ffffff_58%)] px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="rounded-[36px] bg-slate-950 px-6 py-8 text-white shadow-[0_35px_90px_-45px_rgba(15,23,42,0.85)]">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-200">{store.name}</p>
          <h1 className="mt-3 text-3xl font-black">Simple inquiry form</h1>
          <p className="mt-3 max-w-xl text-sm leading-7 text-slate-200">
            Capture reservation, event, brand, and general leads in a way the owner can understand immediately.
          </p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <div className="rounded-[24px] bg-white/10 px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-300">Current leads</p>
              <p className="mt-2 text-3xl font-black">{summary.totalCount}</p>
            </div>
            <div className="rounded-[24px] bg-white/10 px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-300">Open follow-up</p>
              <p className="mt-2 text-3xl font-black">{summary.openCount}</p>
            </div>
          </div>
        </div>

        <div className="rounded-[32px] border border-slate-200 bg-white p-5 shadow-[0_25px_60px_-45px_rgba(15,23,42,0.55)]">
          <div className="grid gap-4 sm:grid-cols-2">
            <label>
              <span className="field-label">Name</span>
              <input
                className="input-base"
                onChange={(event) => {
                  setForm((current) => ({ ...current, customerName: event.target.value }));
                  setFieldErrors((current) => ({ ...current, customerName: undefined }));
                }}
                placeholder="Your name"
                value={form.customerName}
              />
              {fieldErrors.customerName ? <p className="mt-2 text-sm text-rose-600">{fieldErrors.customerName}</p> : null}
            </label>
            <label>
              <span className="field-label">Phone</span>
              <input
                className="input-base"
                onChange={(event) => {
                  setForm((current) => ({ ...current, phone: event.target.value }));
                  setFieldErrors((current) => ({ ...current, phone: undefined }));
                }}
                placeholder="010-0000-0000"
                value={form.phone}
              />
              {fieldErrors.phone ? <p className="mt-2 text-sm text-rose-600">{fieldErrors.phone}</p> : null}
            </label>
            <label>
              <span className="field-label">Email</span>
              <input
                className="input-base"
                onChange={(event) => {
                  setForm((current) => ({ ...current, email: event.target.value }));
                  setFieldErrors((current) => ({ ...current, email: undefined }));
                }}
                placeholder="Optional"
                value={form.email}
              />
              {fieldErrors.email ? <p className="mt-2 text-sm text-rose-600">{fieldErrors.email}</p> : null}
            </label>
            <label>
              <span className="field-label">Preferred visit date</span>
              <input
                className="input-base"
                onChange={(event) => {
                  setForm((current) => ({ ...current, requestedVisitDate: event.target.value }));
                  setFieldErrors((current) => ({ ...current, requestedVisitDate: undefined }));
                }}
                type="date"
                value={form.requestedVisitDate}
              />
              {fieldErrors.requestedVisitDate ? <p className="mt-2 text-sm text-rose-600">{fieldErrors.requestedVisitDate}</p> : null}
            </label>
          </div>

          <div className="mt-5">
            <p className="field-label">Inquiry type</p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {categoryOptions.map((option) => {
                const active = form.category === option.value;

                return (
                  <button
                    className={`rounded-2xl border px-4 py-4 text-left transition ${
                      active ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-slate-50 text-slate-700'
                    }`}
                    key={option.value}
                    onClick={() => {
                      setForm((current) => ({ ...current, category: option.value }));
                      setFieldErrors((current) => ({ ...current, category: undefined }));
                    }}
                    type="button"
                  >
                    <p className="font-semibold">{option.label}</p>
                    <p className={`mt-2 text-sm leading-6 ${active ? 'text-slate-200' : 'text-slate-500'}`}>{option.hint}</p>
                  </button>
                );
              })}
            </div>
          </div>

          <label className="mt-5 block">
            <span className="field-label">Message</span>
            <textarea
              className="input-base min-h-32"
              onChange={(event) => {
                setForm((current) => ({ ...current, message: event.target.value }));
                setFieldErrors((current) => ({ ...current, message: undefined }));
              }}
              placeholder="Tell the owner what you need, when, and for how many guests."
              value={form.message}
            />
            {fieldErrors.message ? <p className="mt-2 text-sm text-rose-600">{fieldErrors.message}</p> : null}
          </label>

          <label className="mt-5 flex items-start gap-3 rounded-3xl border border-slate-200 bg-slate-50 px-4 py-4">
            <input
              checked={form.marketingOptIn}
              className="mt-1 h-4 w-4 rounded border-slate-300"
              onChange={(event) => setForm((current) => ({ ...current, marketingOptIn: event.target.checked }))}
              type="checkbox"
            />
            <div>
              <p className="font-semibold text-slate-900">Allow follow-up message</p>
              <p className="text-sm leading-6 text-slate-500">The owner can keep one clear contact record in CRM for follow-up.</p>
            </div>
          </label>

          {submitMessage ? (
            <div className="mt-5 rounded-3xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">{submitMessage}</div>
          ) : null}

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <Link className="btn-secondary justify-center" to={homePath}>
              Back to store
            </Link>
            <button
              className="btn-primary justify-center"
              disabled={submitMutation.isPending}
              onClick={() => {
                const parsed = publicInquirySchema.safeParse(form);
                if (!parsed.success) {
                  const flattened = parsed.error.flatten().fieldErrors;
                  setFieldErrors({
                    customerName: flattened.customerName?.[0],
                    phone: flattened.phone?.[0],
                    email: flattened.email?.[0],
                    category: flattened.category?.[0],
                    requestedVisitDate: flattened.requestedVisitDate?.[0],
                    message: flattened.message?.[0],
                    marketingOptIn: flattened.marketingOptIn?.[0],
                  });
                  setSubmitMessage('Please complete the required fields before submitting.');
                  return;
                }

                setFieldErrors({});
                setSubmitMessage(null);
                submitMutation.mutate(parsed.data);
              }}
              type="button"
            >
              Submit inquiry
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
