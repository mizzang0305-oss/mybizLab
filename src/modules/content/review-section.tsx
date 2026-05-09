import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useStorePublicContext } from '@/app/layouts/StorePublicLayout';
import { EmptyState } from '@/shared/components/EmptyState';
import { Panel } from '@/shared/components/Panel';
import { queryKeys } from '@/shared/lib/queryKeys';
import {
  listPublicStoreReviews,
  submitPublicStoreReview,
} from '@/shared/lib/services/contentEngineService';

function formatDate(value?: string) {
  if (!value) {
    return '';
  }

  return new Date(value).toLocaleDateString('ko-KR');
}

export function StoreReviewSection() {
  const { publicStore, publicStoreQueryKey } = useStorePublicContext();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    body: '',
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

  const reviewsQuery = useQuery({
    queryKey: queryKeys.publicStoreReviews(storeId),
    queryFn: () => listPublicStoreReviews(storeId),
  });

  const submitMutation = useMutation({
    mutationFn: () =>
      submitPublicStoreReview({
        body: form.body,
        contentUsageConsent: form.contentUsageConsent,
        honeypot: form.honeypot,
        marketingConsent: form.marketingConsent,
        mediaUrl: form.mediaUrl,
        rating: form.rating,
        reviewerDisplayName: form.reviewerDisplayName,
        storeId,
        storeSlug,
        title: form.title,
      }),
    onSuccess: async () => {
      setForm({
        body: '',
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

  const reviews = reviewsQuery.data || [];

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
          {reviewsQuery.isLoading ? <p className="text-sm font-semibold text-slate-500">리뷰를 불러오는 중입니다.</p> : null}
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
          {!reviewsQuery.isLoading && !reviews.length ? (
            <EmptyState title="아직 공개된 리뷰가 없습니다" description="첫 리뷰가 승인되면 이 영역에 표시됩니다." />
          ) : null}
        </div>
      </div>
    </Panel>
  );
}
