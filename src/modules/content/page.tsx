import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';

import { EmptyState } from '@/shared/components/EmptyState';
import { PageHeader } from '@/shared/components/PageHeader';
import { Panel } from '@/shared/components/Panel';
import { useCurrentStore } from '@/shared/hooks/useCurrentStore';
import { usePageMeta } from '@/shared/hooks/usePageMeta';
import { useAdminAccess } from '@/shared/lib/adminSession';
import { queryKeys } from '@/shared/lib/queryKeys';
import {
  approveSocialPublishJob,
  archiveStoreBlogPost,
  convertReviewToBlogDraft,
  createSocialPublishJob,
  createStoreBlogPost,
  createStoreMediaAsset,
  generateCaptionDraft,
  generateTranscriptDraft,
  listSocialProviderCards,
  listSocialPublishJobs,
  listStoreBlogPosts,
  listStoreMediaAssets,
  listStoreReviews,
  publishStoreBlogPost,
  updateStoreReviewStatus,
} from '@/shared/lib/services/contentEngineService';
import type {
  SocialProvider,
  SocialPublishProvider,
  SocialPublishSourceType,
  StoreBlogPostStatus,
  StoreMediaAsset,
  StoreMediaAssetStatus,
  StoreMediaAssetType,
  StoreReviewStatus,
} from '@/shared/types/models';

const reviewStatusTabs: Array<{ label: string; value: StoreReviewStatus | 'all' }> = [
  { label: '전체', value: 'all' },
  { label: '대기', value: 'pending' },
  { label: '게시', value: 'published' },
  { label: '숨김', value: 'hidden' },
  { label: '신고', value: 'reported' },
];

const blogStatusTabs: Array<{ label: string; value: StoreBlogPostStatus | 'all' }> = [
  { label: '전체', value: 'all' },
  { label: '초안', value: 'draft' },
  { label: '게시', value: 'published' },
  { label: '예약', value: 'scheduled' },
  { label: '보관', value: 'archived' },
];

const mediaStatusTabs: Array<{ label: string; value: StoreMediaAssetStatus | 'all' }> = [
  { label: '전체', value: 'all' },
  { label: '초안', value: 'draft' },
  { label: '준비', value: 'ready' },
  { label: '게시', value: 'published' },
  { label: '보관', value: 'archived' },
];

const socialProviders: SocialPublishProvider[] = ['threads', 'youtube', 'tiktok', 'naver_blog', 'kakao_share'];

function useActorProfileId() {
  const { session } = useAdminAccess();
  return session?.profileId;
}

function StatusTabs<TValue extends string>({
  onChange,
  tabs,
  value,
}: {
  onChange: (value: TValue) => void;
  tabs: Array<{ label: string; value: TValue }>;
  value: TValue;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {tabs.map((tab) => (
        <button
          className={tab.value === value ? 'btn-primary' : 'btn-secondary'}
          key={tab.value}
          onClick={() => onChange(tab.value)}
          type="button"
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

function EmptyStoreGuard() {
  return (
    <EmptyState
      title="매장을 먼저 선택해 주세요"
      description="콘텐츠 엔진은 매장 단위로 리뷰, 블로그, 미디어, 게시 초안을 관리합니다."
    />
  );
}

export function ContentReviewsPage() {
  const { currentStore } = useCurrentStore();
  const actorProfileId = useActorProfileId();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<StoreReviewStatus | 'all'>('pending');
  const storeId = currentStore?.id || '';

  usePageMeta('리뷰 관리', '실제 고객 리뷰를 승인하고 MyBiz 매장 콘텐츠로 확장합니다.');

  const reviewsQuery = useQuery({
    queryKey: queryKeys.contentReviews(storeId, status),
    queryFn: () => listStoreReviews(storeId, { actorProfileId, status: status === 'all' ? undefined : status }),
    enabled: Boolean(currentStore),
  });

  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.contentReviews(storeId, status) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.publicStoreReviews(storeId) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.contentBlog(storeId) }),
    ]);
  };

  const statusMutation = useMutation({
    mutationFn: ({ reviewId, nextStatus }: { nextStatus: StoreReviewStatus; reviewId: string }) =>
      updateStoreReviewStatus(storeId, reviewId, nextStatus, { actorProfileId }),
    onSuccess: invalidate,
  });

  const convertMutation = useMutation({
    mutationFn: (reviewId: string) => convertReviewToBlogDraft(storeId, reviewId, { actorProfileId }),
    onSuccess: invalidate,
  });

  if (!currentStore) {
    return <EmptyStoreGuard />;
  }

  const reviews = reviewsQuery.data || [];
  const pendingCount = reviews.filter((review) => review.visibility_status === 'pending').length;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="콘텐츠"
        title="리뷰 관리"
        description="고객이 직접 남긴 리뷰만 접수하고, 매장 승인 후 공개합니다. 외부 플랫폼 리뷰를 대신 작성하지 않습니다."
      />

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-3xl border border-slate-200 bg-white p-5">
          <p className="text-sm font-semibold text-slate-500">확인 대기</p>
          <p className="mt-2 text-3xl font-black text-slate-950">{pendingCount}</p>
        </div>
        <div className="rounded-3xl border border-slate-200 bg-white p-5">
          <p className="text-sm font-semibold text-slate-500">공개 원칙</p>
          <p className="mt-2 text-sm leading-6 text-slate-600">pending 리뷰는 공개 페이지에 표시되지 않습니다.</p>
        </div>
        <div className="rounded-3xl border border-slate-200 bg-white p-5">
          <p className="text-sm font-semibold text-slate-500">재사용 안전장치</p>
          <p className="mt-2 text-sm leading-6 text-slate-600">외부 게시에는 고객 동의와 점주 승인이 모두 필요합니다.</p>
        </div>
      </div>

      <Panel title="리뷰 목록" subtitle="승인, 숨김, 신고 상태로 매장 리뷰를 관리합니다.">
        <StatusTabs onChange={setStatus} tabs={reviewStatusTabs} value={status} />
        <div className="mt-5 space-y-3">
          {reviews.map((review) => (
            <article className="rounded-3xl border border-slate-200 bg-white p-5" key={review.review_id}>
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2 text-xs font-black text-slate-500">
                    <span>{review.rating}점</span>
                    <span>{review.visibility_status}</span>
                    <span>{new Date(review.created_at).toLocaleDateString('ko-KR')}</span>
                    {review.content_usage_consent ? <span className="text-emerald-700">콘텐츠 활용 동의</span> : null}
                  </div>
                  <h2 className="mt-2 text-xl font-black text-slate-950">{review.title || '제목 없는 리뷰'}</h2>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-slate-600">{review.body}</p>
                  <p className="mt-3 text-sm font-semibold text-slate-500">
                    {review.customer_id ? (
                      <Link className="text-orange-700" to={`/dashboard/customers?customer=${review.customer_id}`}>
                        고객 타임라인 연결됨
                      </Link>
                    ) : (
                      '고객 표시 데이터 없음'
                    )}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-slate-500">
                    답글 초안: 방문해 주셔서 감사합니다. 남겨주신 경험은 매장 운영 개선과 안내에 반영하겠습니다.
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  <button
                    className="btn-primary"
                    disabled={statusMutation.isPending}
                    onClick={() => statusMutation.mutate({ nextStatus: 'published', reviewId: review.review_id })}
                    type="button"
                  >
                    게시
                  </button>
                  <button
                    className="btn-secondary"
                    disabled={statusMutation.isPending}
                    onClick={() => statusMutation.mutate({ nextStatus: 'hidden', reviewId: review.review_id })}
                    type="button"
                  >
                    숨김
                  </button>
                  <button
                    className="btn-secondary"
                    disabled={statusMutation.isPending}
                    onClick={() => statusMutation.mutate({ nextStatus: 'reported', reviewId: review.review_id })}
                    type="button"
                  >
                    신고
                  </button>
                  <button
                    className="btn-secondary"
                    disabled={convertMutation.isPending || review.visibility_status !== 'published'}
                    onClick={() => convertMutation.mutate(review.review_id)}
                    type="button"
                  >
                    블로그 초안
                  </button>
                </div>
              </div>
            </article>
          ))}
          {!reviews.length ? (
            <EmptyState title="표시할 리뷰가 없습니다" description="공개 페이지 리뷰 폼으로 접수된 리뷰가 이곳에 쌓입니다." />
          ) : null}
        </div>
      </Panel>
    </div>
  );
}

export function ContentBlogPage() {
  const { currentStore } = useCurrentStore();
  const actorProfileId = useActorProfileId();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<StoreBlogPostStatus | 'all'>('all');
  const [form, setForm] = useState({ body: '', coverImageUrl: '', excerpt: '', slug: '', tags: '', title: '' });
  const storeId = currentStore?.id || '';

  usePageMeta('블로그/소식', '매장 블로그와 소식 글을 초안에서 공개까지 관리합니다.');

  const postsQuery = useQuery({
    queryKey: queryKeys.contentBlog(storeId, status),
    queryFn: () => listStoreBlogPosts(storeId, { actorProfileId, status: status === 'all' ? undefined : status }),
    enabled: Boolean(currentStore),
  });

  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.contentBlog(storeId) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.publicStoreBlog(storeId) }),
    ]);
  };

  const createMutation = useMutation({
    mutationFn: () =>
      createStoreBlogPost(
        storeId,
        {
          body: form.body,
          coverImageUrl: form.coverImageUrl,
          excerpt: form.excerpt,
          slug: form.slug,
          sourceType: 'manual',
          status: 'draft',
          tags: form.tags.split(',').map((tag) => tag.trim()).filter(Boolean),
          title: form.title,
        },
        { actorProfileId },
      ),
    onSuccess: async () => {
      setForm({ body: '', coverImageUrl: '', excerpt: '', slug: '', tags: '', title: '' });
      await invalidate();
    },
  });

  const publishMutation = useMutation({
    mutationFn: (postId: string) => publishStoreBlogPost(storeId, postId, { actorProfileId }),
    onSuccess: invalidate,
  });

  const archiveMutation = useMutation({
    mutationFn: (postId: string) => archiveStoreBlogPost(storeId, postId, { actorProfileId }),
    onSuccess: invalidate,
  });

  if (!currentStore) {
    return <EmptyStoreGuard />;
  }

  const posts = postsQuery.data || [];
  const canCreate = form.title.trim() && form.body.trim();

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="콘텐츠"
        title="블로그/소식"
        description="MyBiz 매장 안에서 검색과 공유에 활용할 소식 글을 관리합니다. 공개 페이지는 published 글만 보여줍니다."
      />

      <Panel title="새 초안 만들기" subtitle="리뷰 전환 초안은 리뷰 관리 화면에서 만들 수 있고, 여기서는 직접 작성 초안을 등록합니다.">
        <div className="grid gap-4 md:grid-cols-2">
          <label>
            <span className="field-label">제목</span>
            <input className="input-base" onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} value={form.title} />
          </label>
          <label>
            <span className="field-label">슬러그</span>
            <input className="input-base" onChange={(event) => setForm((current) => ({ ...current, slug: event.target.value }))} value={form.slug} />
          </label>
          <label className="md:col-span-2">
            <span className="field-label">요약</span>
            <input className="input-base" onChange={(event) => setForm((current) => ({ ...current, excerpt: event.target.value }))} value={form.excerpt} />
          </label>
          <label>
            <span className="field-label">커버 이미지 URL</span>
            <input className="input-base" onChange={(event) => setForm((current) => ({ ...current, coverImageUrl: event.target.value }))} value={form.coverImageUrl} />
          </label>
          <label>
            <span className="field-label">태그</span>
            <input className="input-base" onChange={(event) => setForm((current) => ({ ...current, tags: event.target.value }))} placeholder="소식, 후기" value={form.tags} />
          </label>
          <label className="md:col-span-2">
            <span className="field-label">본문</span>
            <textarea className="input-base min-h-40" onChange={(event) => setForm((current) => ({ ...current, body: event.target.value }))} value={form.body} />
          </label>
        </div>
        <button className="btn-primary mt-4" disabled={!canCreate || createMutation.isPending} onClick={() => createMutation.mutate()} type="button">
          초안 저장
        </button>
      </Panel>

      <Panel title="글 목록" subtitle="초안, 게시, 보관 상태로 매장 글을 관리합니다.">
        <StatusTabs onChange={setStatus} tabs={blogStatusTabs} value={status} />
        <div className="mt-5 space-y-3">
          {posts.map((post) => (
            <article className="rounded-3xl border border-slate-200 bg-white p-5" key={post.post_id}>
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="text-xs font-black text-slate-500">{post.status} · /{post.slug}</p>
                  <h2 className="mt-2 text-xl font-black text-slate-950">{post.title}</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{post.excerpt || post.body.slice(0, 120)}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button className="btn-primary" disabled={publishMutation.isPending || post.status === 'published'} onClick={() => publishMutation.mutate(post.post_id)} type="button">
                    게시
                  </button>
                  <button className="btn-secondary" disabled={archiveMutation.isPending || post.status === 'archived'} onClick={() => archiveMutation.mutate(post.post_id)} type="button">
                    보관
                  </button>
                </div>
              </div>
            </article>
          ))}
          {!posts.length ? <EmptyState title="등록된 글이 없습니다" description="새 초안을 만들거나 리뷰에서 블로그 초안을 생성해 보세요." /> : null}
        </div>
      </Panel>
    </div>
  );
}

export function ContentMediaPage() {
  const { currentStore } = useCurrentStore();
  const actorProfileId = useActorProfileId();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<StoreMediaAssetStatus | 'all'>('all');
  const [form, setForm] = useState({
    altText: '',
    assetType: 'image' as StoreMediaAssetType,
    durationSeconds: '',
    thumbnailUrl: '',
    url: '',
  });
  const [draftByAssetId, setDraftByAssetId] = useState<Record<string, string>>({});
  const storeId = currentStore?.id || '';

  usePageMeta('사진·영상', '매장 미디어 URL을 등록하고 안전한 캡션·자막 초안을 준비합니다.');

  const assetsQuery = useQuery({
    queryKey: queryKeys.contentMedia(storeId, status),
    queryFn: () => listStoreMediaAssets(storeId, { actorProfileId, status: status === 'all' ? undefined : status }),
    enabled: Boolean(currentStore),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      createStoreMediaAsset(
        storeId,
        {
          altText: form.altText,
          assetType: form.assetType,
          durationSeconds: form.durationSeconds ? Number(form.durationSeconds) : undefined,
          status: 'draft',
          thumbnailUrl: form.thumbnailUrl,
          url: form.url,
        },
        { actorProfileId },
      ),
    onSuccess: async () => {
      setForm({ altText: '', assetType: 'image', durationSeconds: '', thumbnailUrl: '', url: '' });
      await queryClient.invalidateQueries({ queryKey: queryKeys.contentMedia(storeId) });
    },
  });

  if (!currentStore) {
    return <EmptyStoreGuard />;
  }

  async function handleDraft(asset: StoreMediaAsset) {
    const caption = await generateCaptionDraft(asset);
    const transcript = await generateTranscriptDraft(asset);
    setDraftByAssetId((current) => ({
      ...current,
      [asset.asset_id]: `${caption.title}\n${caption.description}\n#${caption.hashtags.join(' #')}\n\n${transcript.transcript}`,
    }));
  }

  const assets = assetsQuery.data || [];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="콘텐츠"
        title="사진·영상"
        description="업로드 인프라가 준비되기 전까지 이미지/영상 URL을 등록하고 AI 캡션·자막 초안 인터페이스를 제공합니다."
      />

      <Panel title="미디어 URL 등록" subtitle="외부 업로드는 아직 실행하지 않고 안전한 URL 등록만 지원합니다.">
        <div className="grid gap-4 md:grid-cols-2">
          <label>
            <span className="field-label">유형</span>
            <select className="input-base" onChange={(event) => setForm((current) => ({ ...current, assetType: event.target.value as StoreMediaAssetType }))} value={form.assetType}>
              <option value="image">이미지</option>
              <option value="video">영상</option>
            </select>
          </label>
          <label>
            <span className="field-label">길이(초)</span>
            <input className="input-base" onChange={(event) => setForm((current) => ({ ...current, durationSeconds: event.target.value }))} type="number" value={form.durationSeconds} />
          </label>
          <label className="md:col-span-2">
            <span className="field-label">URL</span>
            <input className="input-base" onChange={(event) => setForm((current) => ({ ...current, url: event.target.value }))} value={form.url} />
          </label>
          <label>
            <span className="field-label">썸네일 URL</span>
            <input className="input-base" onChange={(event) => setForm((current) => ({ ...current, thumbnailUrl: event.target.value }))} value={form.thumbnailUrl} />
          </label>
          <label>
            <span className="field-label">대체 텍스트</span>
            <input className="input-base" onChange={(event) => setForm((current) => ({ ...current, altText: event.target.value }))} value={form.altText} />
          </label>
        </div>
        <button className="btn-primary mt-4" disabled={!form.url.trim() || createMutation.isPending} onClick={() => createMutation.mutate()} type="button">
          미디어 등록
        </button>
      </Panel>

      <Panel title="미디어 목록" subtitle="캡션과 자막 초안은 실제 음성 분석이 아니라 안전한 개발용 초안입니다.">
        <StatusTabs onChange={setStatus} tabs={mediaStatusTabs} value={status} />
        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          {assets.map((asset) => (
            <article className="rounded-3xl border border-slate-200 bg-white p-5" key={asset.asset_id}>
              <p className="text-xs font-black text-slate-500">{asset.asset_type} · {asset.status}</p>
              <p className="mt-2 break-all text-sm font-semibold text-slate-900">{asset.url}</p>
              <p className="mt-2 text-sm leading-6 text-slate-600">{asset.alt_text || '대체 텍스트 없음'}</p>
              <button className="btn-secondary mt-4" onClick={() => void handleDraft(asset)} type="button">
                캡션·자막 초안
              </button>
              {draftByAssetId[asset.asset_id] ? (
                <pre className="mt-4 whitespace-pre-wrap rounded-3xl bg-slate-50 p-4 text-sm leading-6 text-slate-700">
                  {draftByAssetId[asset.asset_id]}
                </pre>
              ) : null}
            </article>
          ))}
          {!assets.length ? <EmptyState title="등록된 미디어가 없습니다" description="매장 사진 또는 영상 URL을 먼저 등록해 주세요." /> : null}
        </div>
      </Panel>
    </div>
  );
}

export function ContentSocialPage() {
  const { currentStore } = useCurrentStore();
  const actorProfileId = useActorProfileId();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    caption: '',
    provider: 'threads' as SocialPublishProvider,
    sourceId: '',
    sourceType: 'manual' as SocialPublishSourceType,
  });
  const storeId = currentStore?.id || '';

  usePageMeta('게시 초안/소셜', '외부 채널 게시 초안과 승인 흐름을 준비합니다.');

  const providersQuery = useQuery({
    queryKey: queryKeys.contentSocial(storeId),
    queryFn: () => listSocialProviderCards(storeId, { actorProfileId }),
    enabled: Boolean(currentStore),
  });
  const jobsQuery = useQuery({
    queryKey: [...queryKeys.contentSocial(storeId), 'jobs'],
    queryFn: () => listSocialPublishJobs(storeId, { actorProfileId }),
    enabled: Boolean(currentStore),
  });

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: queryKeys.contentSocial(storeId) });
  };

  const createMutation = useMutation({
    mutationFn: () =>
      createSocialPublishJob(
        storeId,
        {
          caption: form.caption,
          provider: form.provider,
          sourceId: form.sourceId || undefined,
          sourceType: form.sourceType,
          status: 'draft',
        },
        { actorProfileId },
      ),
    onSuccess: async () => {
      setForm({ caption: '', provider: 'threads', sourceId: '', sourceType: 'manual' });
      await invalidate();
    },
  });

  const approveMutation = useMutation({
    mutationFn: (jobId: string) => approveSocialPublishJob(storeId, jobId, { actorProfileId }),
    onSuccess: invalidate,
  });

  const providerStatus = useMemo(() => {
    return new Map((providersQuery.data || []).map((provider) => [provider.provider, provider.status]));
  }, [providersQuery.data]);

  if (!currentStore) {
    return <EmptyStoreGuard />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="콘텐츠"
        title="게시 초안/소셜"
        description="외부 채널 자동 게시 기능은 계정 연동과 심사 완료 후 사용할 수 있습니다."
      />

      <Panel title="플랫폼 정책 메모" subtitle="MyBiz는 고객 리뷰를 대신 작성하거나 외부 리뷰 플랫폼에 자동 등록하지 않습니다.">
        <div className="grid gap-3 md:grid-cols-2">
          <p className="rounded-3xl border border-slate-200 bg-white p-4 text-sm leading-6 text-slate-600">
            외부 플랫폼 리뷰를 대신 작성하거나 자동 등록하지 않습니다. 고객이 직접 작성할 수 있도록 링크와 안내를 제공합니다.
          </p>
          <p className="rounded-3xl border border-slate-200 bg-white p-4 text-sm leading-6 text-slate-600">
            고객 리뷰를 외부 채널에서 소개하려면 고객의 콘텐츠 활용 동의와 점주의 승인 기록이 필요합니다.
          </p>
        </div>
      </Panel>

      <div className="grid gap-4 lg:grid-cols-5">
        {(providersQuery.data || []).map((provider) => (
          <article className="rounded-3xl border border-slate-200 bg-white p-5" key={provider.provider}>
            <p className="text-sm font-black text-slate-950">{provider.title}</p>
            <p className="mt-2 text-xs font-bold text-slate-500">{provider.status}</p>
            <p className="mt-3 text-sm leading-6 text-slate-600">{provider.copy}</p>
          </article>
        ))}
      </div>

      <Panel title="게시 초안 만들기" subtitle="연동되지 않은 외부 채널은 승인해도 queued 상태로 넘어가지 않습니다.">
        <div className="grid gap-4 md:grid-cols-2">
          <label>
            <span className="field-label">채널</span>
            <select className="input-base" onChange={(event) => setForm((current) => ({ ...current, provider: event.target.value as SocialPublishProvider }))} value={form.provider}>
              {socialProviders.map((provider) => (
                <option key={provider} value={provider}>
                  {provider} ({providerStatus.get(provider as SocialProvider) || 'disabled'})
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="field-label">소스 유형</span>
            <select className="input-base" onChange={(event) => setForm((current) => ({ ...current, sourceType: event.target.value as SocialPublishSourceType }))} value={form.sourceType}>
              <option value="manual">수동</option>
              <option value="review">리뷰</option>
              <option value="blog_post">블로그</option>
              <option value="media">미디어</option>
            </select>
          </label>
          <label className="md:col-span-2">
            <span className="field-label">소스 ID</span>
            <input className="input-base" onChange={(event) => setForm((current) => ({ ...current, sourceId: event.target.value }))} value={form.sourceId} />
          </label>
          <label className="md:col-span-2">
            <span className="field-label">게시 문안</span>
            <textarea className="input-base min-h-32" onChange={(event) => setForm((current) => ({ ...current, caption: event.target.value }))} value={form.caption} />
          </label>
        </div>
        <button className="btn-primary mt-4" disabled={!form.caption.trim() || createMutation.isPending} onClick={() => createMutation.mutate()} type="button">
          초안 저장
        </button>
      </Panel>

      <Panel title="게시 작업" subtitle="실제 외부 게시 호출은 아직 실행하지 않습니다.">
        <div className="space-y-3">
          {(jobsQuery.data || []).map((job) => (
            <article className="rounded-3xl border border-slate-200 bg-white p-5" key={job.job_id}>
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="text-xs font-black text-slate-500">{job.provider} · {job.status}</p>
                  <p className="mt-2 text-sm leading-6 text-slate-700">{job.caption || '문안 없음'}</p>
                  {job.error_message ? <p className="mt-2 text-sm font-semibold text-amber-700">{job.error_message}</p> : null}
                </div>
                <button className="btn-secondary" disabled={approveMutation.isPending} onClick={() => approveMutation.mutate(job.job_id)} type="button">
                  승인
                </button>
              </div>
            </article>
          ))}
          {!jobsQuery.data?.length ? <EmptyState title="게시 초안이 없습니다" description="리뷰, 블로그, 미디어를 바탕으로 승인용 게시 초안을 만들 수 있습니다." /> : null}
        </div>
      </Panel>
    </div>
  );
}
