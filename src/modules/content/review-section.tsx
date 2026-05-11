import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';

import { useStorePublicContext } from '@/app/layouts/StorePublicLayout';
import { EmptyState } from '@/shared/components/EmptyState';
import { Panel } from '@/shared/components/Panel';
import { usePageMeta, useStructuredData } from '@/shared/hooks/usePageMeta';
import { queryKeys } from '@/shared/lib/queryKeys';
import {
  buildStoreReviewJsonLd,
  canonicalUrl,
  safeImageUrl,
} from '@/shared/lib/seo';
import {
  listPublicStoreReviews,
  submitPublicStoreReview,
} from '@/shared/lib/services/contentEngineService';
import type { ReviewRequestLinkSourceType } from '@/shared/types/models';

function formatDate(value?: string) {
  if (!value) {
    return '';
  }

  return new Date(value).toLocaleDateString('ko-KR');
}

const requestSourceTypes: ReviewRequestLinkSourceType[] = ['order', 'reservation', 'waiting', 'customer'];

function normalizeRequestSource(value: string | null) {
  return requestSourceTypes.includes(value as ReviewRequestLinkSourceType)
    ? (value as ReviewRequestLinkSourceType)
    : undefined;
}

export function StoreReviewSection({ showPublishedReviews = true }: { showPublishedReviews?: boolean } = {}) {
  const { publicStore, publicStoreQueryKey } = useStorePublicContext();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const [form, setForm] = useState({
    body: '',
    captchaToken: '',
    contentUsageConsent: false,
    honeypot: '',
    marketingConsent: false,
    mediaUrl: '',
    rating: 5,
    reviewerDisplayName: '',
    title: '',
  });
  const [message, setMessage] = useState<string | null>(null);
  const storeId = publicStore.store.id;
  const storeSlug = publicStore.store.slug;
  const source = normalizeRequestSource(searchParams.get('source'));
  const reviewRequestToken = searchParams.get('r') || undefined;

  const reviewsQuery = useQuery({
    queryKey: queryKeys.publicStoreReviews(storeId),
    queryFn: () => listPublicStoreReviews(storeId, { storeSlug }),
    enabled: showPublishedReviews,
  });

  const submitMutation = useMutation({
    mutationFn: () =>
      submitPublicStoreReview({
        body: form.body,
        captchaToken: form.captchaToken,
        contentUsageConsent: form.contentUsageConsent,
        honeypot: form.honeypot,
        marketingConsent: form.marketingConsent,
        mediaUrl: form.mediaUrl,
        orderId: searchParams.get('orderId') || undefined,
        rating: form.rating,
        reservationId: searchParams.get('reservationId') || undefined,
        reviewRequestToken,
        reviewerDisplayName: form.reviewerDisplayName,
        source,
        storeId,
        storeSlug,
        title: form.title,
        waitingId: searchParams.get('waitingId') || undefined,
        customerId: searchParams.get('customerId') || undefined,
      }),
    onSuccess: async () => {
      setForm({
        body: '',
        captchaToken: '',
        contentUsageConsent: false,
        honeypot: '',
        marketingConsent: false,
        mediaUrl: '',
        rating: 5,
        reviewerDisplayName: '',
        title: '',
      });
      setMessage('리뷰가 접수되었습니다. 매장 확인 후 공개될 수 있습니다.');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.publicStoreReviews(storeId) }),
        queryClient.invalidateQueries({ queryKey: publicStoreQueryKey }),
      ]);
    },
    onError: (error) => {
      setMessage(error instanceof Error ? error.message : '리뷰를 접수하지 못했습니다. 입력 내용을 다시 확인해 주세요.');
    },
  });

  const reviews = showPublishedReviews ? reviewsQuery.data || [] : [];
  const seoStore = {
    address: publicStore.location?.address || publicStore.store.address,
    business_type: publicStore.store.business_type,
    description: publicStore.store.description,
    id: publicStore.store.id,
    logo_url: publicStore.store.logo_url || publicStore.media[0]?.image_url,
    name: publicStore.store.name,
    phone: publicStore.store.phone,
    slug: publicStore.store.slug,
    updated_at: publicStore.store.updated_at,
  };

  useStructuredData(
    'store-reviews',
    showPublishedReviews && reviews.length ? buildStoreReviewJsonLd({ reviews, store: seoStore }) : null,
  );

  return (
    <Panel
      title="방문 리뷰"
      subtitle="실제 방문 경험을 남겨 주세요. 접수된 리뷰는 매장 확인 후 공개될 수 있습니다."
    >
      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <form
          className="rounded-3xl border border-slate-200 bg-white p-5"
          onSubmit={(event) => {
            event.preventDefault();
            submitMutation.mutate();
          }}
        >
          <div className="hidden">
            <label>
              확인
              <input
                autoComplete="off"
                onChange={(event) => setForm((current) => ({ ...current, honeypot: event.target.value }))}
                tabIndex={-1}
                value={form.honeypot}
              />
            </label>
          </div>
          <div className="grid gap-4">
            <label>
              <span className="field-label">평점</span>
              <select
                className="input-base"
                onChange={(event) => setForm((current) => ({ ...current, rating: Number(event.target.value) }))}
                value={form.rating}
              >
                {[5, 4, 3, 2, 1].map((rating) => (
                  <option key={rating} value={rating}>
                    {rating}점
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className="field-label">제목</span>
              <input className="input-base" onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} value={form.title} />
            </label>
            <label>
              <span className="field-label">리뷰 내용</span>
              <textarea
                className="input-base min-h-32"
                onChange={(event) => setForm((current) => ({ ...current, body: event.target.value }))}
                required
                value={form.body}
              />
            </label>
            <label>
              <span className="field-label">표시 이름</span>
              <input className="input-base" onChange={(event) => setForm((current) => ({ ...current, reviewerDisplayName: event.target.value }))} value={form.reviewerDisplayName} />
            </label>
            <label>
              <span className="field-label">사진/영상 URL</span>
              <input className="input-base" onChange={(event) => setForm((current) => ({ ...current, mediaUrl: event.target.value }))} value={form.mediaUrl} />
            </label>
            <label className="flex items-start gap-3 text-sm leading-6 text-slate-600">
              <input
                checked={form.marketingConsent}
                className="mt-1 h-4 w-4 shrink-0 accent-orange-600"
                onChange={(event) => setForm((current) => ({ ...current, marketingConsent: event.target.checked }))}
                type="checkbox"
              />
              매장의 재방문 안내나 혜택 안내를 받을 수 있습니다.
            </label>
            <label className="flex items-start gap-3 text-sm leading-6 text-slate-600">
              <input
                checked={form.contentUsageConsent}
                className="mt-1 h-4 w-4 shrink-0 accent-orange-600"
                onChange={(event) => setForm((current) => ({ ...current, contentUsageConsent: event.target.checked }))}
                type="checkbox"
              />
              이 리뷰를 매장 콘텐츠 초안에 활용하는 데 동의합니다.
            </label>
          </div>
          <button className="btn-primary mt-5" disabled={!form.body.trim() || submitMutation.isPending} type="submit">
            리뷰 남기기
          </button>
          {message ? <p className="mt-3 text-sm font-semibold text-slate-600">{message}</p> : null}
        </form>

        <div className="space-y-3">
          {showPublishedReviews && reviewsQuery.isLoading ? <p className="text-sm font-semibold text-slate-500">리뷰를 불러오는 중입니다.</p> : null}
          {reviews.map((review) => (
            <article className="rounded-3xl border border-slate-200 bg-white p-5" key={review.review_id}>
              <div className="flex flex-wrap items-center gap-2 text-xs font-black text-slate-500">
                <span>{review.rating}점</span>
                <span>{formatDate(review.created_at)}</span>
              </div>
              <h3 className="mt-2 text-lg font-black text-slate-950">{review.title || '방문 리뷰'}</h3>
              <p className="mt-2 text-sm leading-7 text-slate-600">{review.body}</p>
              <p className="mt-3 text-sm font-semibold text-slate-500">{review.reviewer_display_name || '방문 고객'}</p>
            </article>
          ))}
          {showPublishedReviews && !reviewsQuery.isLoading && !reviews.length ? (
            <EmptyState title="아직 공개된 리뷰가 없습니다" description="첫 리뷰가 승인되면 이 영역에 표시됩니다." />
          ) : null}
        </div>
      </div>
    </Panel>
  );
}

export function StoreReviewRequestPage() {
  const { publicStore } = useStorePublicContext();

  usePageMeta(
    `${publicStore.store.name} 리뷰 작성`,
    `${publicStore.store.name} 방문 경험을 MyBiz 리뷰로 남겨 주세요. 리뷰는 매장 확인 후 공개될 수 있습니다.`,
    {
      canonicalUrl: canonicalUrl(`/s/${publicStore.store.slug}/review`),
      ogImage: safeImageUrl(publicStore.store.logo_url || publicStore.media[0]?.image_url),
      ogType: 'website',
    },
  );

  return (
    <div className="space-y-6">
      <StoreReviewSection showPublishedReviews={false} />
      <p className="rounded-2xl border border-slate-200 bg-white p-4 text-sm font-semibold leading-6 text-slate-600">
        이 페이지는 고객이 직접 MyBiz 리뷰를 작성하는 공간입니다. 외부 플랫폼 리뷰를 대신 작성하거나 자동 등록하지 않습니다.
      </p>
    </div>
  );
}
