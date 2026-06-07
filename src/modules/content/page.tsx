import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  type OAuthProvider as StoreOAuthProvider,
  deleteStoreOAuthCredential,
  getDefaultRedirectUri,
  listStoreOAuthCredentials,
  saveStoreOAuthCredential,
} from '@/shared/lib/services/storeOAuthCredentialsService';
import { OAuthSetupGuideModal } from './OAuthSetupGuide';
import qrcode from 'qrcode-generator';
import { Link } from 'react-router-dom';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';

import { EmptyState } from '@/shared/components/EmptyState';
import { PageHeader } from '@/shared/components/PageHeader';
import { Panel } from '@/shared/components/Panel';
import { useCurrentStore } from '@/shared/hooks/useCurrentStore';
import { usePageMeta } from '@/shared/hooks/usePageMeta';
import { useAdminAccess } from '@/shared/lib/adminSession';
import { queryKeys } from '@/shared/lib/queryKeys';
import { canonicalUrl } from '@/shared/lib/seo';
import { getSttReadiness } from '@/shared/lib/services/sttProvider';
import { YOUTUBE_REQUIRED_SCOPES, getYouTubeProviderReadiness } from '@/shared/lib/services/youtubeProvider';
import {
  approveSocialPublishJob,
  archiveStoreBlogPost,
  buildReviewRequestUrl,
  convertReviewToBlogDraft,
  createReviewRequestLink,
  createSocialPublishJob,
  createStoreBlogPost,
  createStoreMediaAsset,
  deleteStoreMediaAsset,
  disconnectSocialAccount,
  generateCaptionDraft,
  generateTranscriptDraft,
  getContentReadinessDashboard,
  listReviewRequestLinks,
  listSocialProviderCards,
  listSocialPublishJobs,
  listStoreBlogPosts,
  listStoreMediaAssets,
  listStoreReviews,
  publishStoreBlogPost,
  startSocialOAuth,
  transcribeStoreMediaAsset,
  updateStoreReviewStatus,
} from '@/shared/lib/services/contentEngineService';
import type {
  SocialProvider,
  SocialPublishProvider,
  SocialPublishSourceType,
  ReviewRequestLinkSourceType,
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

const readinessStatusLabels: Record<string, string> = {
  connected: '연결됨',
  disabled: '비활성',
  error: '오류',
  missing_config: '설정 필요',
  ready: '준비됨',
};

const consentStatusLabels: Record<string, string> = {
  granted: '동의 완료',
  missing: '동의 부족',
  not_required: '동의 불필요',
  unknown: '확인 필요',
};

const approvalStatusLabels: Record<string, string> = {
  approval_missing: '승인 필요',
  approved: '승인 기록 있음',
  waiting_approval: '승인 대기',
};

const blockedReasonLabels: Record<string, string> = {
  approval_missing: '점주 승인 필요',
  captcha_failed: 'captcha 확인 실패',
  content_usage_consent_missing: '고객 동의 부족',
  customer_impersonation_copy_detected: '고객 사칭 문구 감지',
  duplicate_submit_window: '중복 제출 차단',
  failed: '실패 상태',
  honeypot_detected: 'honeypot 탐지',
  missing_env: '환경 설정 필요',
  provider_disabled: '제공자 비활성',
  rate_limit: 'rate limit 차단',
  token_disabled: '비활성 token',
  token_expired: '만료 token',
  token_invalid: '유효하지 않은 token',
  token_not_connected: '계정 연결 필요',
  token_max_uses_exceeded: 'token max uses 초과',
  token_store_mismatch: '다른 매장 token',
  unsafe_copy_detected: '안전하지 않은 문구 감지',
};

const reviewRequestSourceOptions: Array<{ label: string; value: ReviewRequestLinkSourceType }> = [
  { label: '매장 기본 링크', value: 'store' },
  { label: '주문 연결', value: 'order' },
  { label: '예약 연결', value: 'reservation' },
  { label: '웨이팅 연결', value: 'waiting' },
  { label: '고객 연결', value: 'customer' },
];

function getDashboardBaseUrl() {
  if (typeof window !== 'undefined' && window.location.origin) {
    return window.location.origin;
  }

  return 'https://mybiz.ai.kr';
}

function ReviewRequestQrSvg({ url }: { url: string }) {
  const modules = useMemo(() => {
    const qr = qrcode(0, 'M');
    qr.addData(url);
    qr.make();

    const count = qr.getModuleCount();
    const cells: Array<{ col: number; row: number }> = [];
    for (let row = 0; row < count; row += 1) {
      for (let col = 0; col < count; col += 1) {
        if (qr.isDark(row, col)) {
          cells.push({ col, row });
        }
      }
    }

    return { cells, count };
  }, [url]);

  return (
    <svg
      aria-label="리뷰 요청 QR 코드"
      className="h-48 w-48 rounded-2xl bg-white p-3 shadow-inner"
      data-review-qr-url={url}
      role="img"
      viewBox={`0 0 ${modules.count} ${modules.count}`}
    >
      <rect fill="#ffffff" height={modules.count} width={modules.count} x="0" y="0" />
      {modules.cells.map((cell) => (
        <rect fill="#0f172a" height="1" key={`${cell.row}-${cell.col}`} width="1" x={cell.col} y={cell.row} />
      ))}
    </svg>
  );
}

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

function downloadQrAsSvg(url: string) {
  const svgEl = document.querySelector<SVGElement>(`[data-review-qr-url="${CSS.escape(url)}"]`);
  if (!svgEl) return;

  const blob = new Blob([svgEl.outerHTML], { type: 'image/svg+xml' });
  const anchor = document.createElement('a');
  anchor.href = URL.createObjectURL(blob);
  anchor.download = 'review-qr.svg';
  anchor.click();
  URL.revokeObjectURL(anchor.href);
}

function downloadQrAsPng(url: string, size = 512) {
  const svgEl = document.querySelector<SVGElement>(`[data-review-qr-url="${CSS.escape(url)}"]`);
  if (!svgEl) return;

  // Serialise SVG → Blob → ObjectURL → Image → Canvas → PNG
  const svgData = new XMLSerializer().serializeToString(svgEl);
  const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
  const svgUrl = URL.createObjectURL(svgBlob);

  const img = new Image();
  img.onload = () => {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) { URL.revokeObjectURL(svgUrl); return; }

    // White background for QR readability
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, size, size);
    ctx.drawImage(img, 0, 0, size, size);
    URL.revokeObjectURL(svgUrl);

    canvas.toBlob((pngBlob) => {
      if (!pngBlob) return;
      const pngUrl = URL.createObjectURL(pngBlob);
      const anchor = document.createElement('a');
      anchor.href = pngUrl;
      anchor.download = 'review-qr.png';
      anchor.click();
      URL.revokeObjectURL(pngUrl);
    }, 'image/png');
  };
  img.onerror = () => URL.revokeObjectURL(svgUrl);
  img.src = svgUrl;
}

export function ContentReviewRequestsPage() {
  const { currentStore } = useCurrentStore();
  const actorProfileId = useActorProfileId();
  const queryClient = useQueryClient();
  const [sourceType, setSourceType] = useState<ReviewRequestLinkSourceType>('store');
  const [sourceId, setSourceId] = useState('');
  const [copyMessage, setCopyMessage] = useState('');
  const storeId = currentStore?.id || '';
  const baseUrl = getDashboardBaseUrl();

  usePageMeta('리뷰 요청 링크', '방문·주문·예약 이후 고객에게 보낼 MyBiz 리뷰 링크와 QR을 준비합니다.');

  const linksQuery = useQuery({
    queryKey: queryKeys.contentReviewRequests(storeId),
    queryFn: () => listReviewRequestLinks(storeId, { actorProfileId }),
    enabled: Boolean(currentStore),
  });
  const reviewsQuery = useQuery({
    queryKey: queryKeys.contentReviews(storeId, 'recent'),
    queryFn: () => listStoreReviews(storeId, { actorProfileId }),
    enabled: Boolean(currentStore),
  });

  const defaultLink = useMemo(() => {
    if (!currentStore) {
      return '';
    }

    return buildReviewRequestUrl({
      baseUrl,
      sourceType: 'store',
      storeSlug: currentStore.slug,
    });
  }, [baseUrl, currentStore]);

  const previewLink = useMemo(() => {
    if (!currentStore || (sourceType !== 'store' && !sourceId.trim())) {
      return defaultLink;
    }

    return buildReviewRequestUrl({
      baseUrl,
      publicToken: sourceType === 'store' ? undefined : 'review-token-created-after-save',
      sourceId: sourceType === 'store' ? undefined : sourceId,
      sourceType,
      storeSlug: currentStore.slug,
    });
  }, [baseUrl, currentStore, defaultLink, sourceId, sourceType]);

  const createMutation = useMutation({
    mutationFn: () =>
      createReviewRequestLink(
        storeId,
        {
          baseUrl,
          sourceId: sourceType === 'store' ? undefined : sourceId,
          sourceType,
        },
        { actorProfileId },
      ),
    onSuccess: async (link) => {
      setSourceId('');
      setCopyMessage('리뷰 요청 링크를 만들었습니다.');
      await queryClient.invalidateQueries({ queryKey: queryKeys.contentReviewRequests(storeId) });
      await handleCopyLink(link.url);
    },
  });

  async function handleCopyLink(url: string) {
    if (!url) {
      return;
    }

    try {
      await navigator.clipboard.writeText(url);
      setCopyMessage('링크를 클립보드에 복사했습니다.');
    } catch {
      setCopyMessage('브라우저 복사 권한이 없어 링크를 직접 선택해 복사해 주세요.');
    }
  }

  if (!currentStore) {
    return <EmptyStoreGuard />;
  }

  const links = linksQuery.data || [];
  const defaultReviewLink = links.find((link) => link.source_type === 'store')?.url || defaultLink;
  const latestLink = links[0]?.url || defaultReviewLink;
  const recentReviews = (reviewsQuery.data || []).slice(0, 4);
  const canCreate = sourceType === 'store' || Boolean(sourceId.trim());

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="콘텐츠"
        title="리뷰 요청 링크"
        description="고객 경험 직후 MyBiz 리뷰를 자연스럽게 요청하고, 접수된 리뷰는 pending 상태로 저장해 점주 승인 후 공개합니다."
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_22rem]">
        <Panel title="기본 리뷰 링크" subtitle="매장 전체 고객에게 보낼 수 있는 안전한 리뷰 작성 링크입니다.">
          <div className="grid gap-5 md:grid-cols-[1fr_auto] md:items-center">
            <div className="min-w-0">
              <p className="break-all rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-semibold text-slate-700">
                {defaultReviewLink}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <button className="btn-primary" onClick={() => void handleCopyLink(defaultReviewLink)} type="button">
                  링크 복사
                </button>
                <Link className="btn-secondary" to={`/dashboard/content/reviews`}>
                  리뷰 관리로 이동
                </Link>
                <button className="btn-secondary" onClick={() => downloadQrAsSvg(defaultReviewLink)} type="button">
                  QR 다운로드 (SVG)
                </button>
                <button className="btn-secondary" onClick={() => downloadQrAsPng(defaultReviewLink)} type="button">
                  QR 다운로드 (PNG)
                </button>
              </div>
              {copyMessage ? <p className="mt-3 text-sm font-semibold text-slate-600">{copyMessage}</p> : null}
            </div>
            <ReviewRequestQrSvg url={defaultReviewLink} />
          </div>
        </Panel>

        <Panel title="QR 미리보기" subtitle="최근 생성 링크 또는 기본 링크를 QR로 표시합니다.">
          <div className="flex flex-col items-center gap-4">
            <ReviewRequestQrSvg url={latestLink} />
            <p className="break-all text-center text-xs font-semibold leading-5 text-slate-500">{latestLink}</p>
          </div>
        </Panel>
      </div>

      <Panel title="연결 링크 생성" subtitle="주문·예약·웨이팅·고객 ID가 매장 범위 안에 있을 때만 리뷰 링크에 연결합니다.">
        <div className="grid gap-4 lg:grid-cols-[12rem_1fr_auto] lg:items-end">
          <label>
            <span className="field-label">연결 유형</span>
            <select
              className="input-base"
              onChange={(event) => setSourceType(event.target.value as ReviewRequestLinkSourceType)}
              value={sourceType}
            >
              {reviewRequestSourceOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="field-label">연결 ID</span>
            <input
              className="input-base"
              disabled={sourceType === 'store'}
              onChange={(event) => setSourceId(event.target.value)}
              placeholder={sourceType === 'store' ? '기본 링크는 ID가 필요 없습니다.' : '주문/예약/웨이팅/고객 ID'}
              value={sourceType === 'store' ? '' : sourceId}
            />
          </label>
          <button
            className="btn-primary"
            disabled={!canCreate || createMutation.isPending}
            onClick={() => createMutation.mutate()}
            type="button"
          >
            링크 생성
          </button>
        </div>
        <p className="mt-4 break-all rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-semibold text-slate-700">
          {previewLink}
        </p>
        {createMutation.error ? (
          <p className="mt-3 text-sm font-semibold text-red-600">
            {createMutation.error instanceof Error ? createMutation.error.message : '리뷰 요청 링크를 만들 수 없습니다.'}
          </p>
        ) : null}
      </Panel>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="최근 리뷰 요청" subtitle="점주가 생성한 리뷰 요청 링크입니다.">
          <div className="space-y-3">
            {links.map((link) => (
              <article className="rounded-2xl border border-slate-200 bg-white p-4" key={link.link_id}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-black uppercase text-slate-500">{link.source_type}</p>
                    <p className="mt-1 break-all text-sm font-semibold text-slate-700">{link.url}</p>
                    <p className="mt-1 text-xs font-semibold text-slate-500">
                      {link.disabled_at
                        ? 'disabled'
                        : link.expires_at
                          ? `expires ${new Date(link.expires_at).toLocaleDateString('ko-KR')}`
                          : 'active'}
                    </p>
                    <p className="mt-2 text-xs font-semibold text-slate-500">
                      조회 {link.usage_count} · 제출 {link.submission_count}
                    </p>
                  </div>
                  <button className="btn-secondary" onClick={() => void handleCopyLink(link.url)} type="button">
                    복사
                  </button>
                </div>
              </article>
            ))}
            {!links.length ? (
              <EmptyState
                title="아직 생성한 요청 링크가 없습니다"
                description="기본 링크는 바로 사용할 수 있고, 주문·예약·웨이팅 연결 링크는 필요할 때 만들 수 있습니다."
              />
            ) : null}
          </div>
        </Panel>

        <Panel title="최근 제출 리뷰" subtitle="요청 링크 이후 들어온 리뷰는 리뷰 관리에서 승인·숨김·신고 처리합니다.">
          <div className="space-y-3">
            {recentReviews.map((review) => (
              <article className="rounded-2xl border border-slate-200 bg-white p-4" key={review.review_id}>
                <div className="flex flex-wrap items-center gap-2 text-xs font-black text-slate-500">
                  <span>{review.rating}점</span>
                  <span>{review.visibility_status}</span>
                  {review.content_usage_consent ? <span className="text-emerald-700">콘텐츠 사용 동의</span> : null}
                </div>
                <h2 className="mt-2 text-base font-black text-slate-950">{review.title || '제목 없는 리뷰'}</h2>
                <p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-600">{review.body}</p>
              </article>
            ))}
            {!recentReviews.length ? (
              <EmptyState title="최근 제출 리뷰가 없습니다" description="고객이 리뷰를 남기면 이 영역과 리뷰 관리에 표시됩니다." />
            ) : null}
            <div className="flex flex-wrap gap-2">
              <Link className="btn-primary" to="/dashboard/content/reviews">
                리뷰 관리로 이동
              </Link>
              <Link className="btn-secondary" to="/dashboard/content/blog">
                블로그 초안 만들기
              </Link>
            </div>
          </div>
        </Panel>
      </div>

      <p className="rounded-2xl border border-slate-200 bg-white p-4 text-sm font-semibold leading-6 text-slate-600">
        분석은 다음 배포에서 제공됩니다. 외부 플랫폼 리뷰를 대신 작성하거나 자동 등록하지 않으며, 고객이 직접 작성한 MyBiz 리뷰만 점주 승인 후 공개됩니다.
      </p>
    </div>
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

// ─── Tiptap rich text editor ─────────────────────────────────────────────────
function TiptapEditor({ value, onChange }: { value: string; onChange: (html: string) => void }) {
  const editor = useEditor({
    extensions: [StarterKit],
    content: value,
    onUpdate: ({ editor: e }) => onChange(e.getHTML()),
    editorProps: {
      attributes: {
        class: 'prose prose-sm max-w-none min-h-[10rem] focus:outline-none px-4 py-3',
      },
    },
  });

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white focus-within:border-orange-400 focus-within:ring-2 focus-within:ring-orange-100">
      {/* Toolbar */}
      <div className="flex flex-wrap gap-1 border-b border-slate-100 bg-slate-50 px-3 py-2">
        {[
          { label: 'B', title: '굵게', action: () => editor?.chain().focus().toggleBold().run(), active: () => Boolean(editor?.isActive('bold')) },
          { label: 'I', title: '기울임', action: () => editor?.chain().focus().toggleItalic().run(), active: () => Boolean(editor?.isActive('italic')) },
          { label: 'S', title: '취소선', action: () => editor?.chain().focus().toggleStrike().run(), active: () => Boolean(editor?.isActive('strike')) },
          { label: 'H2', title: '소제목', action: () => editor?.chain().focus().toggleHeading({ level: 2 }).run(), active: () => Boolean(editor?.isActive('heading', { level: 2 })) },
          { label: '≡', title: '목록', action: () => editor?.chain().focus().toggleBulletList().run(), active: () => Boolean(editor?.isActive('bulletList')) },
          { label: '1.', title: '번호 목록', action: () => editor?.chain().focus().toggleOrderedList().run(), active: () => Boolean(editor?.isActive('orderedList')) },
          { label: '❝', title: '인용구', action: () => editor?.chain().focus().toggleBlockquote().run(), active: () => Boolean(editor?.isActive('blockquote')) },
        ].map(({ label, title, action, active }) => (
          <button
            key={label}
            title={title}
            type="button"
            onMouseDown={(e) => { e.preventDefault(); action(); }}
            className={[
              'rounded-lg px-2.5 py-1 text-xs font-bold transition',
              active() ? 'bg-orange-100 text-orange-700' : 'text-slate-500 hover:bg-slate-200 hover:text-slate-900',
            ].join(' ')}
          >
            {label}
          </button>
        ))}
      </div>
      <EditorContent editor={editor} />
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
  const publishedPosts = posts.filter((post) => post.status === 'published');
  const blogCanonicalPreview = currentStore ? canonicalUrl(`/${currentStore.slug}/blog`) : '';

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="콘텐츠"
        title="블로그/소식"
        description="MyBiz 매장 안에서 검색과 공유에 활용할 소식 글을 관리합니다. 공개 페이지는 published 글만 보여줍니다."
      />

      <Panel title="SEO 미리보기" subtitle="검색 노출은 공개된 매장과 published 글만 대상으로 생성됩니다.">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-3xl border border-slate-200 bg-white p-5">
            <p className="text-xs font-black text-slate-500">Canonical</p>
            <p className="mt-2 break-all text-sm font-semibold text-slate-700">{blogCanonicalPreview}</p>
            <p className="mt-3 text-sm leading-6 text-slate-500">
              리뷰 요청 토큰 URL과 초안/보관 글은 sitemap과 schema에 포함하지 않습니다.
            </p>
          </div>
          <div className="rounded-3xl border border-slate-200 bg-white p-5">
            <p className="text-xs font-black text-slate-500">Sitemap 포함 상태</p>
            <p className="mt-2 text-2xl font-black text-slate-950">{publishedPosts.length}개 published 글</p>
            <p className="mt-3 text-sm leading-6 text-slate-500">
              noindex 토글과 세부 OG 이미지 편집은 다음 배포에서 제공됩니다.
            </p>
          </div>
        </div>
      </Panel>

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
          <div className="md:col-span-2">
            <span className="field-label">본문</span>
            <TiptapEditor
              value={form.body}
              onChange={(html) => setForm((current) => ({ ...current, body: html }))}
            />
          </div>
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
  const [sttMessageByAssetId, setSttMessageByAssetId] = useState<Record<string, string>>({});
  const storeId = currentStore?.id || '';
  const sttReadiness = useMemo(() => getSttReadiness(), []);

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

  const transcribeMutation = useMutation({
    mutationFn: (assetId: string) =>
      transcribeStoreMediaAsset(storeId, assetId, {
        actorProfileId,
      }),
    onSuccess: async (result) => {
      setSttMessageByAssetId((current) => ({
        ...current,
        [result.asset.asset_id]: result.message,
      }));
      await queryClient.invalidateQueries({ queryKey: queryKeys.contentMedia(storeId) });
    },
  });

  const deleteAssetMutation = useMutation({
    mutationFn: (assetId: string) => deleteStoreMediaAsset(storeId, assetId, { actorProfileId }),
    onSuccess: async () => queryClient.invalidateQueries({ queryKey: queryKeys.contentMedia(storeId) }),
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

      <Panel title="STT 자막 생성 준비" subtitle="음성 분석 설정이 완료되면 영상 자막과 설명 초안을 생성할 수 있습니다.">
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-xs font-black text-slate-500">provider</p>
            <p className="mt-2 text-lg font-black text-slate-950">{sttReadiness.provider}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-xs font-black text-slate-500">상태</p>
            <p className="mt-2 text-lg font-black text-slate-950">{sttReadiness.ready ? 'ready' : 'disabled'}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-xs font-black text-slate-500">최대 길이</p>
            <p className="mt-2 text-lg font-black text-slate-950">{sttReadiness.maxDurationSeconds}초</p>
          </div>
        </div>
        <p className="mt-4 text-sm leading-6 text-slate-600">
          {sttReadiness.message}
        </p>
        <p className="mt-2 text-sm leading-6 text-amber-700">
          URL 등록 자산은 서버가 외부 파일을 직접 가져오지 않습니다. 업로드된 내부 파일이 준비된 뒤 STT를 실행할 수 있습니다.
        </p>
      </Panel>

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

      <Panel title="미디어 목록" subtitle="STT가 비활성화된 경우 실제 전사나 자막을 생성하지 않습니다.">
        <StatusTabs onChange={setStatus} tabs={mediaStatusTabs} value={status} />
        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          {assets.map((asset) => {
            const sttDisabled = !sttReadiness.ready || asset.asset_type !== 'video' || !asset.storage_path;

            return (
              <article className="rounded-3xl border border-slate-200 bg-white p-5" key={asset.asset_id}>
                <div className="flex items-start justify-between gap-2">
                  <p className="text-xs font-black text-slate-500">{asset.asset_type} · {asset.status}</p>
                  <button
                    className="shrink-0 rounded-full px-3 py-1 text-xs font-bold text-rose-600 hover:bg-rose-50"
                    disabled={deleteAssetMutation.isPending}
                    onClick={() => deleteAssetMutation.mutate(asset.asset_id)}
                    type="button"
                  >
                    삭제
                  </button>
                </div>
                <p className="mt-2 break-all text-sm font-semibold text-slate-900">{asset.url}</p>
                <p className="mt-2 text-sm leading-6 text-slate-600">{asset.alt_text || '대체 텍스트 없음'}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button className="btn-secondary" onClick={() => void handleDraft(asset)} type="button">
                    캡션 초안 보기
                  </button>
                  <button
                    className="btn-secondary"
                    disabled={sttDisabled || transcribeMutation.isPending}
                    onClick={() => transcribeMutation.mutate(asset.asset_id)}
                    type="button"
                  >
                    자막 초안 생성
                  </button>
                </div>
                {sttDisabled ? (
                  <p className="mt-3 text-sm leading-6 text-amber-700">
                    음성 분석 설정과 내부 업로드 파일이 준비되면 자막 초안을 생성할 수 있습니다.
                  </p>
                ) : null}
                {sttMessageByAssetId[asset.asset_id] ? (
                  <p className="mt-3 text-sm font-bold text-slate-700">{sttMessageByAssetId[asset.asset_id]}</p>
                ) : null}
                {asset.transcript ? (
                  <div className="mt-4 rounded-2xl bg-slate-50 p-4">
                    <p className="text-xs font-black text-slate-500">transcript</p>
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">{asset.transcript}</p>
                  </div>
                ) : null}
                {asset.captions_srt || asset.captions_vtt ? (
                  <div className="mt-4 grid gap-3">
                    {asset.captions_srt ? (
                      <pre className="max-h-56 overflow-auto whitespace-pre-wrap rounded-2xl bg-slate-50 p-4 text-xs leading-5 text-slate-700">
                        {asset.captions_srt}
                      </pre>
                    ) : null}
                    {asset.captions_vtt ? (
                      <pre className="max-h-56 overflow-auto whitespace-pre-wrap rounded-2xl bg-slate-50 p-4 text-xs leading-5 text-slate-700">
                        {asset.captions_vtt}
                      </pre>
                    ) : null}
                  </div>
                ) : null}
                {draftByAssetId[asset.asset_id] ? (
                  <pre className="mt-4 whitespace-pre-wrap rounded-3xl bg-slate-50 p-4 text-sm leading-6 text-slate-700">
                    {draftByAssetId[asset.asset_id]}
                  </pre>
                ) : null}
              </article>
            );
          })}
          {!assets.length ? <EmptyState title="등록된 미디어가 없습니다" description="매장 사진 또는 영상 URL을 먼저 등록해 주세요." /> : null}
        </div>
      </Panel>
    </div>
  );
}

export function ContentStatusPage() {
  const { currentStore } = useCurrentStore();
  const actorProfileId = useActorProfileId();
  const storeId = currentStore?.id || '';
  const queryClient = useQueryClient();

  usePageMeta('콘텐츠 상태판', '콘텐츠 확산 readiness와 승인 대기 상태를 확인합니다.');

  const dashboardQuery = useQuery({
    queryKey: queryKeys.contentStatus(storeId),
    queryFn: () => getContentReadinessDashboard(storeId, { actorProfileId }),
    enabled: Boolean(currentStore),
  });

  const approveMutation = useMutation({
    mutationFn: (jobId: string) => approveSocialPublishJob(storeId, jobId, { actorProfileId }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: queryKeys.contentStatus(storeId) }),
  });
  const dashboard = dashboardQuery.data;
  const stats = dashboard?.stats;
  const statCards = stats
    ? [
        { label: '리뷰 요청 링크', value: stats.reviewRequestLinkCount },
        { label: 'pending 리뷰', value: stats.pendingReviewCount },
        { label: 'published 리뷰', value: stats.publishedReviewCount },
        { label: '블로그 draft', value: stats.blogDraftCount },
        { label: '블로그 published', value: stats.blogPublishedCount },
        { label: '미디어 asset', value: stats.mediaAssetCount },
        { label: 'transcript ready asset', value: stats.transcriptReadyAssetCount },
        { label: 'caption ready asset', value: stats.captionReadyAssetCount },
        { label: 'social draft', value: stats.socialDraftCount },
        { label: 'waiting approval', value: stats.socialWaitingApprovalCount },
        { label: 'failed', value: stats.socialFailedCount },
        { label: 'consent 부족 차단', value: stats.consentBlockedJobCount },
        { label: 'review abuse 차단', value: stats.reviewSubmitBlockedAttemptCount },
      ]
    : [];

  if (!currentStore) {
    return <EmptyStoreGuard />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="콘텐츠"
        title="콘텐츠 확산 운영 상태판"
        description="리뷰, 블로그, 미디어, SEO, YouTube, STT, Threads, Naver, Kakao 준비 상태를 점주 승인 흐름 기준으로 확인합니다."
      />

      <Panel title="안전 게이트" subtitle="외부 게시 실행 전에 확인해야 하는 운영 기준입니다.">
        <div className="grid gap-3 md:grid-cols-2">
          <p className="rounded-3xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold leading-6 text-amber-800">
            {dashboard?.safetyCopy.externalPosting ||
              '외부 채널 게시 기능은 계정 연동, 고객 동의, 점주 승인, 제공자 설정이 모두 완료된 뒤 사용할 수 있습니다.'}
          </p>
          <p className="rounded-3xl border border-slate-200 bg-white p-4 text-sm font-semibold leading-6 text-slate-700">
            {dashboard?.safetyCopy.reviewPolicy || '외부 플랫폼 리뷰를 대신 작성하거나 자동 등록하지 않습니다.'}
          </p>
        </div>
      </Panel>

      {dashboardQuery.isLoading ? (
        <Panel title="상태를 불러오는 중" subtitle="콘텐츠 확산 운영 지표를 집계하고 있습니다.">
          <p className="text-sm text-slate-500">잠시만 기다려 주세요.</p>
        </Panel>
      ) : null}

      {dashboardQuery.isError ? (
        <Panel title="상태판을 불러오지 못했습니다" subtitle="스토어 권한 또는 데이터 연결 상태를 확인해 주세요.">
          <p className="text-sm font-semibold text-rose-700">
            {dashboardQuery.error instanceof Error ? dashboardQuery.error.message : '콘텐츠 상태판 조회 중 오류가 발생했습니다.'}
          </p>
        </Panel>
      ) : null}

      {dashboard ? (
        <>
          <Panel title="상태 카드" subtitle="콘텐츠 확산 운영 흐름의 핵심 숫자입니다.">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {statCards.map((card) => (
                <article className="rounded-3xl border border-slate-200 bg-white p-4" key={card.label}>
                  <p className="text-xs font-black text-slate-500">{card.label}</p>
                  <p className="mt-2 text-3xl font-black text-slate-950">{card.value}</p>
                </article>
              ))}
            </div>
          </Panel>

          <Panel title="provider readiness" subtitle="값은 표시하지 않고 필요한 환경 변수 이름만 표시합니다.">
            <div className="grid gap-4 lg:grid-cols-3">
              {dashboard.providerCards.map((provider) => (
                <article className="rounded-3xl border border-slate-200 bg-white p-5" key={provider.provider}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-black text-slate-950">{provider.title}</p>
                      <p className="mt-2 text-xs font-black text-slate-500">
                        {readinessStatusLabels[provider.status] || provider.status}
                      </p>
                    </div>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
                      {provider.provider}
                    </span>
                  </div>
                  <p className="mt-4 text-sm leading-6 text-slate-600">{provider.copy}</p>
                  <p className="mt-3 text-sm font-semibold leading-6 text-slate-700">{provider.nextAction}</p>
                  {provider.missingEnvNames.length ? (
                    <p className="mt-3 text-xs font-bold leading-5 text-amber-700">
                      missing: {provider.missingEnvNames.join(', ')}
                    </p>
                  ) : null}
                  {provider.requiredScopes.length ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {provider.requiredScopes.map((scope) => (
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600" key={scope}>
                          {scope}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </article>
              ))}
            </div>
          </Panel>

          <Panel title="승인 대기 큐" subtitle="이 화면에서는 실제 외부 게시를 실행하지 않습니다.">
            <div className="space-y-3">
              {dashboard.approvalQueue.map((item) => (
                <article className="rounded-3xl border border-slate-200 bg-white p-5" key={item.jobId}>
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <p className="text-xs font-black text-slate-500">
                        {item.provider} · {item.sourceType} · {new Date(item.createdAt).toLocaleDateString('ko-KR')}
                      </p>
                      <p className="mt-2 text-sm font-black text-slate-900">{item.sourceTitle}</p>
                      <p className="mt-2 text-sm leading-6 text-slate-600">
                        {consentStatusLabels[item.consentStatus]} · {approvalStatusLabels[item.approvalStatus]}
                      </p>
                      <p className="mt-2 text-sm font-semibold text-slate-700">{item.nextAction}</p>
                    </div>
                    <button
                      className="btn-secondary"
                      disabled={approveMutation.isPending}
                      onClick={() => approveMutation.mutate(item.jobId)}
                      type="button"
                    >
                      승인 검토
                    </button>
                  </div>
                </article>
              ))}
              {!dashboard.approvalQueue.length ? (
                <EmptyState title="승인 대기 항목이 없습니다" description="새 게시 초안이 만들어지면 이곳에서 동의와 승인 상태를 확인할 수 있습니다." />
              ) : null}
            </div>
          </Panel>

          <Panel title="차단/실패 큐" subtitle="동의, 설정, 승인, 안전 문구 문제를 먼저 해결해야 합니다.">
            <div className="space-y-3">
              {dashboard.blockedQueue.map((item, index) => (
                <article className="rounded-3xl border border-slate-200 bg-white p-5" key={`${item.reasonCode}-${item.jobId || index}`}>
                  <p className="text-xs font-black text-rose-500">{blockedReasonLabels[item.reasonCode] || '차단 사유 확인'}</p>
                  <p className="mt-2 text-sm font-black text-slate-900">{item.sourceTitle}</p>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{item.reason}</p>
                </article>
              ))}
              {!dashboard.blockedQueue.length ? (
                <EmptyState title="차단된 항목이 없습니다" description="동의, 승인, provider 설정 문제를 발견하면 이곳에 표시합니다." />
              ) : null}
            </div>
          </Panel>
        </>
      ) : null}
    </div>
  );
}

// ─── Per-store OAuth credentials input panel ─────────────────────────────────

const CREDENTIAL_PROVIDERS: Array<{
  key: StoreOAuthProvider;
  label: string;
  icon: string;
  fields: Array<{ name: 'clientId' | 'clientSecret' | 'redirectUri'; label: string; placeholder: string; secret?: boolean }>;
  guideUrl: string;
}> = [
  {
    key: 'threads',
    label: 'Threads (Meta)',
    icon: '🧵',
    guideUrl: 'https://developers.facebook.com/apps',
    fields: [
      { name: 'clientId', label: '앱 ID (App ID)', placeholder: 'Meta Threads 앱 ID' },
      { name: 'clientSecret', label: '앱 시크릿 (App Secret)', placeholder: 'Meta 앱 시크릿', secret: true },
      { name: 'redirectUri', label: 'Redirect URI', placeholder: 'https://mybiz.ai.kr/api/auth/threads/callback' },
    ],
  },
  {
    key: 'naver_blog',
    label: 'Naver Blog',
    icon: '🟢',
    guideUrl: 'https://developers.naver.com/apps/#/register',
    fields: [
      { name: 'clientId', label: '클라이언트 ID', placeholder: 'Naver 앱 Client ID' },
      { name: 'clientSecret', label: '클라이언트 시크릿', placeholder: 'Naver 앱 Client Secret', secret: true },
      { name: 'redirectUri', label: 'Redirect URI', placeholder: 'https://mybiz.ai.kr/api/auth/naver/callback' },
    ],
  },
  {
    key: 'youtube',
    label: 'YouTube (Google)',
    icon: '▶️',
    guideUrl: 'https://console.cloud.google.com/apis/library/youtube.googleapis.com',
    fields: [
      { name: 'clientId', label: '클라이언트 ID', placeholder: 'Google OAuth 클라이언트 ID' },
      { name: 'clientSecret', label: '클라이언트 시크릿', placeholder: 'Google OAuth 클라이언트 시크릿', secret: true },
      { name: 'redirectUri', label: 'Redirect URI', placeholder: 'https://mybiz.ai.kr/api/auth/youtube/callback' },
    ],
  },
  {
    key: 'kakao_share',
    label: 'Kakao',
    icon: '💛',
    guideUrl: 'https://developers.kakao.com/console/app',
    fields: [
      { name: 'clientId', label: 'JavaScript 키', placeholder: 'Kakao 앱 JavaScript 키' },
      { name: 'clientSecret', label: 'REST API 키 (선택)', placeholder: '선택 사항', secret: true },
      { name: 'redirectUri', label: 'Redirect URI (선택)', placeholder: 'https://mybiz.ai.kr/api/auth/kakao/callback' },
    ],
  },
];

function StoreCredentialsPanel({ storeId }: { storeId: string }) {
  const queryClient = useQueryClient();
  const [activeProvider, setActiveProvider] = useState<StoreOAuthProvider | null>(null);
  const [guideProvider, setGuideProvider] = useState<StoreOAuthProvider | null>(null);
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});
  const [form, setForm] = useState<Record<string, { clientId: string; clientSecret: string; redirectUri: string }>>({});
  const [saveMsg, setSaveMsg] = useState<Record<string, { text: string; ok: boolean }>>({});

  const credentialsQuery = useQuery({
    queryKey: ['store-oauth-credentials', storeId],
    queryFn: () => listStoreOAuthCredentials(storeId),
    enabled: Boolean(storeId),
  });
  const savedMap = useMemo(
    () => new Map((credentialsQuery.data || []).map((c) => [c.provider, c])),
    [credentialsQuery.data],
  );

  const saveMutation = useMutation({
    mutationFn: async (provider: StoreOAuthProvider) => {
      const values = form[provider] || { clientId: '', clientSecret: '', redirectUri: '' };
      return saveStoreOAuthCredential(storeId, {
        provider,
        clientId: values.clientId,
        clientSecret: values.clientSecret,
        redirectUri: values.redirectUri || getDefaultRedirectUri(provider),
      });
    },
    onSuccess: (result, provider) => {
      setSaveMsg((prev) => ({
        ...prev,
        [provider]: result.ok ? { text: '저장됐습니다', ok: true } : { text: result.error || '저장 실패', ok: false },
      }));
      setTimeout(() => setSaveMsg((prev) => { const next = { ...prev }; delete next[provider]; return next; }), 3000);
      void queryClient.invalidateQueries({ queryKey: ['store-oauth-credentials', storeId] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (provider: StoreOAuthProvider) => deleteStoreOAuthCredential(storeId, provider),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['store-oauth-credentials', storeId] }),
  });

  function getFormValue(provider: StoreOAuthProvider, field: 'clientId' | 'clientSecret' | 'redirectUri') {
    return form[provider]?.[field] ?? '';
  }
  function setFormValue(provider: StoreOAuthProvider, field: 'clientId' | 'clientSecret' | 'redirectUri', value: string) {
    setForm((prev) => ({ ...prev, [provider]: { ...(prev[provider] || { clientId: '', clientSecret: '', redirectUri: '' }), [field]: value } }));
  }

  return (
    <>
    {guideProvider && (
      <OAuthSetupGuideModal providerKey={guideProvider} onClose={() => setGuideProvider(null)} />
    )}
    <Panel
      title="내 소셜 계정 API 키 설정"
      subtitle="각 플랫폼에서 발급받은 API 키를 입력하면 내 계정으로 직접 연동됩니다. 입력한 키는 데이터베이스에 안전하게 저장됩니다."
    >
      {/* Provider tabs */}
      <div className="flex flex-wrap gap-2 border-b border-slate-100 pb-4">
        {CREDENTIAL_PROVIDERS.map((p) => {
          const saved = savedMap.get(p.key);
          return (
            <button
              key={p.key}
              className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold transition-all ${
                activeProvider === p.key
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
              onClick={() => setActiveProvider(activeProvider === p.key ? null : p.key)}
              type="button"
            >
              <span>{p.icon}</span>
              <span>{p.label}</span>
              {saved?.hasCredentials && (
                <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" title="키 저장됨" />
              )}
            </button>
          );
        })}
      </div>

      {/* Active provider form */}
      {activeProvider && (() => {
        const providerMeta = CREDENTIAL_PROVIDERS.find((p) => p.key === activeProvider)!;
        const saved = savedMap.get(activeProvider);
        const msg = saveMsg[activeProvider];
        return (
          <div className="mt-5 space-y-5">
            {/* 가이드 링크 */}
            <div className="rounded-2xl border border-orange-100 bg-orange-50 px-4 py-3">
              <p className="text-xs font-semibold text-slate-700 mb-2">
                {providerMeta.icon} API 키가 처음이신가요? 단계별 발급 방법을 안내해 드립니다.
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  className="rounded-full bg-orange-500 px-4 py-2 text-xs font-black text-white hover:bg-orange-600 transition"
                  onClick={() => setGuideProvider(activeProvider as StoreOAuthProvider)}
                  type="button"
                >
                  📋 단계별 발급 방법 보기
                </button>
                <a
                  className="rounded-full bg-white border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 transition"
                  href={providerMeta.guideUrl}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  🔗 {providerMeta.label} 개발자 콘솔
                </a>
              </div>
            </div>

            {/* Fields */}
            <div className="grid gap-4 sm:grid-cols-2">
              {providerMeta.fields.map((field) => (
                <div key={field.name}>
                  <label className="block text-xs font-black text-slate-700 mb-1.5">{field.label}</label>
                  <div className="relative">
                    <input
                      className="input-base pr-10 font-mono text-xs"
                      placeholder={field.placeholder}
                      type={field.secret && !showSecrets[`${activeProvider}-${field.name}`] ? 'password' : 'text'}
                      value={getFormValue(activeProvider, field.name)}
                      onChange={(e) => setFormValue(activeProvider, field.name, e.target.value)}
                    />
                    {field.secret && (
                      <button
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-700"
                        onClick={() => setShowSecrets((prev) => ({ ...prev, [`${activeProvider}-${field.name}`]: !prev[`${activeProvider}-${field.name}`] }))}
                        type="button"
                      >
                        {showSecrets[`${activeProvider}-${field.name}`] ? '숨김' : '보기'}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Redirect URI hint */}
            <div className="rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3">
              <p className="text-xs font-bold text-blue-800">개발자 콘솔의 "Redirect URI" 또는 "Callback URL" 항목에 아래 주소를 등록하세요:</p>
              <div className="mt-2 flex items-center gap-2">
                <code className="flex-1 truncate text-xs font-mono text-blue-700">{getDefaultRedirectUri(activeProvider)}</code>
                <button
                  className="rounded-full bg-white px-2 py-1 text-xs font-bold text-blue-600 shadow-sm hover:bg-blue-100"
                  onClick={() => void navigator.clipboard.writeText(getDefaultRedirectUri(activeProvider))}
                  type="button"
                >
                  복사
                </button>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-wrap items-center gap-3">
              <button
                className="btn-primary"
                disabled={saveMutation.isPending || !getFormValue(activeProvider, 'clientId')}
                onClick={() => saveMutation.mutate(activeProvider)}
                type="button"
              >
                {saveMutation.isPending ? '저장 중...' : 'API 키 저장'}
              </button>
              {saved?.hasCredentials && (
                <button
                  className="btn-secondary text-rose-600"
                  disabled={deleteMutation.isPending}
                  onClick={() => { if (window.confirm('저장된 API 키를 삭제하시겠습니까?')) void deleteMutation.mutate(activeProvider); }}
                  type="button"
                >
                  키 삭제
                </button>
              )}
              {msg && (
                <p className={`text-sm font-bold ${msg.ok ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {msg.ok ? '✓ ' : '✗ '}{msg.text}
                </p>
              )}
              {saved?.hasCredentials && (
                <p className="text-xs font-semibold text-emerald-600">✓ API 키가 저장되어 있습니다. 아래에서 계정을 연동하세요.</p>
              )}
            </div>
          </div>
        );
      })()}
    </Panel>
    </>
  );
}

// ─── OAuth setup guide — replaced by OAuthSetupGuideModal (OAuthSetupGuide.tsx) ──
const _DELETED_OAUTH_SETUP_GUIDES = {
  threads: {
    icon: '🧵',
    label: 'Threads',
    color: '#000000',
    steps: [
      { title: 'Meta 개발자 앱 생성', desc: 'developers.facebook.com → 새 앱 → Threads API 추가', link: 'https://developers.facebook.com/apps' },
      { title: 'Redirect URI 등록', desc: '앱 설정 → Threads API → Callback URL에 아래 URI 등록', code: `${window?.location?.origin || 'https://mybiz.ai.kr'}/api/auth/threads/callback` },
      { title: 'Vercel 환경 변수 설정', desc: '아래 변수를 Vercel 프로젝트 → Settings → Environment Variables에 추가', envVars: ['THREADS_CLIENT_ID', 'THREADS_CLIENT_SECRET', 'THREADS_REDIRECT_URI', 'THREADS_PUBLISH_ENABLED=true'] },
    ],
  },
  naver_blog: {
    icon: '🟢',
    label: 'Naver Blog',
    color: '#03C75A',
    steps: [
      { title: 'Naver Developers 앱 등록', desc: '네이버 개발자 센터에서 애플리케이션을 생성하고 Blog 권한을 추가합니다', link: 'https://developers.naver.com/apps/#/register' },
      { title: 'Redirect URI 등록', desc: '서비스 URL / Callback URL 항목에 아래 URI 등록', code: `${window?.location?.origin || 'https://mybiz.ai.kr'}/api/auth/naver/callback` },
      { title: 'Vercel 환경 변수 설정', desc: '클라이언트 ID/Secret을 복사해 아래 변수명으로 추가', envVars: ['NAVER_CLIENT_ID', 'NAVER_CLIENT_SECRET', 'NAVER_REDIRECT_URI', 'NAVER_BLOG_WRITE_ENABLED=true'] },
    ],
  },
  kakao_share: {
    icon: '💛',
    label: 'Kakao',
    color: '#FEE500',
    steps: [
      { title: 'Kakao Developers 앱 생성', desc: '카카오 개발자 센터에서 앱을 만들고 플랫폼(Web)을 등록합니다', link: 'https://developers.kakao.com/console/app' },
      { title: 'JavaScript 키 복사', desc: '앱 설정 → 앱 키 → JavaScript 키를 복사합니다', code: '' },
      { title: 'Vercel 환경 변수 설정', desc: '아래 변수를 Vercel에 추가하면 공유하기 버튼이 활성화됩니다', envVars: ['KAKAO_JAVASCRIPT_KEY', 'KAKAO_SHARE_ENABLED=true'] },
    ],
  },
  youtube: {
    icon: '▶️',
    label: 'YouTube',
    color: '#FF0000',
    steps: [
      { title: 'Google Cloud 프로젝트 생성', desc: 'Google Cloud Console에서 프로젝트를 만들고 YouTube Data API v3를 활성화합니다', link: 'https://console.cloud.google.com/apis/library/youtube.googleapis.com' },
      { title: 'OAuth 2.0 클라이언트 생성', desc: '사용자 인증 정보 → OAuth 2.0 클라이언트 ID → 웹 애플리케이션 → 아래 URI 등록', code: `${window?.location?.origin || 'https://mybiz.ai.kr'}/api/auth/youtube/callback` },
      { title: 'Vercel 환경 변수 설정', desc: '클라이언트 ID/Secret과 암호화 키를 아래 변수명으로 추가', envVars: ['YOUTUBE_CLIENT_ID', 'YOUTUBE_CLIENT_SECRET', 'YOUTUBE_REDIRECT_URI', 'YOUTUBE_OAUTH_ENABLED=true', 'YOUTUBE_UPLOAD_ENABLED=true', 'TOKEN_ENCRYPTION_KEY'] },
    ],
  },
} as const;

type OAuthGuideKey = keyof typeof _DELETED_OAUTH_SETUP_GUIDES;

function _DeletedOAuthSetupModal({ providerKey, onClose }: { providerKey: OAuthGuideKey; onClose: () => void }) {
  const guide = _DELETED_OAUTH_SETUP_GUIDES[providerKey];
  const [copied, setCopied] = useState<string | null>(null);

  function copyToClipboard(text: string, key: string) {
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(key);
      setTimeout(() => setCopied(null), 2000);
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-3xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-slate-100 px-6 py-5">
          <span className="text-2xl">{guide.icon}</span>
          <div className="flex-1">
            <p className="text-sm font-black text-slate-950">{guide.label} 계정 연동 설정</p>
            <p className="text-xs text-slate-500">아래 단계를 순서대로 완료하면 계정 연동 버튼이 활성화됩니다</p>
          </div>
          <button
            className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            onClick={onClose}
            type="button"
          >
            ✕
          </button>
        </div>

        {/* Steps */}
        <div className="space-y-5 p-6">
          {guide.steps.map((step, i) => (
            <div className="flex gap-4" key={i}>
              <div
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-black text-white"
                style={{ background: guide.color === '#FEE500' ? '#f59e0b' : guide.color || '#ec5b13' }}
              >
                {i + 1}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-black text-slate-900">{step.title}</p>
                <p className="mt-1 text-xs leading-5 text-slate-500">{step.desc}</p>
                {'link' in step && step.link && (
                  <a
                    className="mt-2 inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700 hover:bg-slate-200"
                    href={step.link}
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    🔗 개발자 센터 열기
                  </a>
                )}
                {'code' in step && step.code && (
                  <div className="mt-2 flex items-center gap-2 rounded-2xl bg-slate-50 px-3 py-2">
                    <code className="min-w-0 flex-1 truncate text-xs font-mono text-slate-700">{step.code}</code>
                    <button
                      className="shrink-0 rounded-full bg-white px-2 py-1 text-xs font-bold text-slate-600 shadow-sm hover:bg-slate-100"
                      onClick={() => copyToClipboard(step.code, `code-${i}`)}
                      type="button"
                    >
                      {copied === `code-${i}` ? '✓ 복사됨' : '복사'}
                    </button>
                  </div>
                )}
                {'envVars' in step && step.envVars.length > 0 && (
                  <div className="mt-2 space-y-1.5">
                    {step.envVars.map((env) => (
                      <div className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-1.5" key={env}>
                        <code className="min-w-0 flex-1 truncate text-xs font-mono font-bold text-slate-800">{env}</code>
                        <button
                          className="shrink-0 rounded-full bg-white px-2 py-0.5 text-[10px] font-bold text-slate-500 shadow-sm hover:bg-slate-100"
                          onClick={() => copyToClipboard(env.split('=')[0], `env-${env}`)}
                          type="button"
                        >
                          {copied === `env-${env}` ? '✓' : '복사'}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="rounded-b-3xl border-t border-slate-100 bg-slate-50 px-6 py-4">
          <p className="text-xs leading-5 text-slate-500">
            환경 변수를 Vercel에 추가하고 재배포하면 계정 연동 버튼이 자동으로 활성화됩니다.
            Vercel 대시보드 → 프로젝트 → Settings → Environment Variables에서 설정하세요.
          </p>
          <a
            className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-blue-600 hover:underline"
            href="https://vercel.com/dashboard"
            rel="noopener noreferrer"
            target="_blank"
          >
            🚀 Vercel 대시보드 열기
          </a>
        </div>
      </div>
    </div>
  );
}

const PROVIDER_ICON: Record<string, string> = {
  threads: '🧵',
  naver_blog: '🟢',
  kakao_share: '💛',
  youtube: '▶️',
};

type SocialProviderCard = {
  provider: string;
  title: string;
  status: string;
  copy: string;
  displayName?: string;
  missingEnvNames?: string[];
  requiredScopes?: string[];
};

function SocialProviderGrid({
  providers,
  connectMutation,
  disconnectMutation,
}: {
  providers: SocialProviderCard[];
  connectMutation: { isPending: boolean; mutate: (p: 'threads' | 'naver_blog' | 'youtube') => void };
  disconnectMutation: { isPending: boolean; mutate: (p: 'threads' | 'naver_blog' | 'youtube') => void };
}) {
  const [guideOpen, setGuideOpen] = useState<OAuthGuideKey | null>(null);

  return (
    <>
      {guideOpen && <OAuthSetupGuideModal providerKey={guideOpen} onClose={() => setGuideOpen(null)} />}

      <div className="grid gap-4 lg:grid-cols-3">
        {providers.map((provider) => {
          const isKakao = provider.provider === 'kakao_share';
          const isConnectable = !isKakao && (provider.provider === 'threads' || provider.provider === 'naver_blog');
          const isConnected = provider.status === 'connected';
          const hasMissingEnv = (provider.missingEnvNames?.length ?? 0) > 0;
          const isPending = connectMutation.isPending || disconnectMutation.isPending;
          const guideKey = (provider.provider === 'threads' || provider.provider === 'naver_blog' || provider.provider === 'kakao_share')
            ? provider.provider as OAuthGuideKey
            : null;

          return (
            <article
              className={`rounded-3xl border p-5 transition-all duration-300 ${
                isConnected
                  ? 'border-emerald-200 bg-emerald-50'
                  : hasMissingEnv
                  ? 'border-slate-200 bg-white'
                  : 'border-slate-200 bg-white'
              }`}
              key={provider.provider}
            >
              {/* Header */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <span className="text-xl">{PROVIDER_ICON[provider.provider] || '🔗'}</span>
                  <div>
                    <p className="text-sm font-black text-slate-950">{provider.title}</p>
                    <div className="mt-0.5 flex items-center gap-1.5">
                      <span
                        className={`inline-block h-1.5 w-1.5 rounded-full ${
                          isConnected ? 'bg-emerald-500' : 'bg-slate-300'
                        }`}
                      />
                      <span className={`text-xs font-bold ${isConnected ? 'text-emerald-600' : 'text-slate-400'}`}>
                        {isConnected ? '연결됨' : hasMissingEnv ? '설정 필요' : '연결 안 됨'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {isConnected && provider.displayName && (
                <p className="mt-2 text-xs font-semibold text-emerald-700">@{provider.displayName}</p>
              )}

              <p className="mt-3 text-xs leading-5 text-slate-500">{provider.copy}</p>

              {/* Action area */}
              <div className="mt-4 flex flex-wrap gap-2">
                {isKakao ? (
                  <>
                    <button
                      className="btn-secondary text-xs"
                      disabled
                      title="카카오 JavaScript SDK 키 설정 후 활성화"
                      type="button"
                    >
                      공유하기 (준비 중)
                    </button>
                    {guideKey && (
                      <button
                        className="btn-secondary text-xs"
                        onClick={() => setGuideOpen(guideKey)}
                        type="button"
                      >
                        ⚙ 설정 방법
                      </button>
                    )}
                  </>
                ) : isConnected ? (
                  <button
                    className="btn-secondary text-xs text-rose-600"
                    disabled={isPending}
                    onClick={() => disconnectMutation.mutate(provider.provider as 'threads' | 'naver_blog')}
                    type="button"
                  >
                    연결 해제
                  </button>
                ) : hasMissingEnv ? (
                  <>
                    <button
                      className="btn-primary text-xs"
                      onClick={() => guideKey && setGuideOpen(guideKey)}
                      type="button"
                    >
                      ⚙ 설정 방법 보기
                    </button>
                  </>
                ) : (
                  <button
                    className="btn-primary text-xs"
                    disabled={isPending || !isConnectable}
                    onClick={() => isConnectable && connectMutation.mutate(provider.provider as 'threads' | 'naver_blog')}
                    type="button"
                  >
                    계정 연동하기
                  </button>
                )}
              </div>

              {/* Missing env hint */}
              {hasMissingEnv && (
                <div className="mt-3 rounded-2xl border border-amber-100 bg-amber-50 px-3 py-2">
                  <p className="text-[11px] font-bold text-amber-700">필요한 환경 변수:</p>
                  <p className="mt-0.5 text-[11px] font-mono text-amber-600">{provider.missingEnvNames?.join(', ')}</p>
                </div>
              )}
            </article>
          );
        })}
      </div>
    </>
  );
}

function YouTubeProviderPanel({
  youtubeProvider,
  youtubeReadiness,
  youtubeJobs,
  connectMutation,
  disconnectMutation,
}: {
  youtubeProvider: SocialProviderCard | undefined;
  youtubeReadiness: ReturnType<typeof getYouTubeProviderReadiness>;
  youtubeJobs: Array<{ job_id: string; provider: string; status: string; caption?: string | null }>;
  connectMutation: { isPending: boolean; mutate: (p: 'threads' | 'naver_blog' | 'youtube') => void };
  disconnectMutation: { isPending: boolean; mutate: (p: 'threads' | 'naver_blog' | 'youtube') => void };
}) {
  const [guideOpen, setGuideOpen] = useState(false);
  const isConnected = youtubeProvider?.status === 'connected';

  return (
    <>
      {guideOpen && <OAuthSetupGuideModal providerKey="youtube" onClose={() => setGuideOpen(false)} />}

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        {/* Left: connection card */}
        <div className={`rounded-3xl border p-6 transition-all ${isConnected ? 'border-emerald-200 bg-emerald-50' : 'border-slate-200 bg-white'}`}>
          <div className="flex items-center gap-3">
            <span className="text-3xl">▶️</span>
            <div>
              <p className="text-base font-black text-slate-950">YouTube</p>
              <div className="flex items-center gap-1.5">
                <span className={`inline-block h-1.5 w-1.5 rounded-full ${isConnected ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                <span className={`text-xs font-bold ${isConnected ? 'text-emerald-600' : youtubeReadiness.oauthReady ? 'text-slate-500' : 'text-amber-600'}`}>
                  {isConnected ? '연결됨' : youtubeReadiness.oauthReady ? '연결 준비됨' : '설정 필요'}
                </span>
              </div>
            </div>
          </div>

          {isConnected && youtubeProvider?.displayName && (
            <p className="mt-3 text-sm font-semibold text-emerald-700">{youtubeProvider.displayName}</p>
          )}

          <p className="mt-4 text-sm leading-6 text-slate-600">
            YouTube 채널을 연결하면 AI가 생성한 영상 대본을 업로드하고 자막을 자동 등록합니다.
          </p>

          {/* Required scopes */}
          <div className="mt-4 flex flex-wrap gap-1.5">
            {YOUTUBE_REQUIRED_SCOPES.map((scope) => (
              <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-bold text-slate-600" key={scope}>
                {scope.split('/').pop()}
              </span>
            ))}
          </div>

          {/* Action buttons */}
          <div className="mt-5 flex flex-wrap gap-2">
            {isConnected ? (
              <button
                className="btn-secondary text-xs text-rose-600"
                disabled={disconnectMutation.isPending}
                onClick={() => disconnectMutation.mutate('youtube')}
                type="button"
              >
                연결 해제
              </button>
            ) : youtubeReadiness.oauthReady ? (
              <button
                className="btn-primary text-xs"
                disabled={connectMutation.isPending}
                onClick={() => connectMutation.mutate('youtube')}
                type="button"
              >
                YouTube 계정 연동하기
              </button>
            ) : (
              <button
                className="btn-primary text-xs"
                onClick={() => setGuideOpen(true)}
                type="button"
              >
                ⚙ 설정 방법 보기
              </button>
            )}
          </div>

          {/* Missing env hint */}
          {!youtubeReadiness.oauthReady && (
            <div className="mt-4 rounded-2xl border border-amber-100 bg-amber-50 px-3 py-2">
              <p className="text-[11px] font-bold text-amber-700">필요한 환경 변수:</p>
              <p className="mt-0.5 text-[11px] font-mono leading-5 text-amber-600">
                {youtubeReadiness.missingOAuthEnvNames.join(', ')}
              </p>
            </div>
          )}
        </div>

        {/* Right: recent jobs */}
        <div className="rounded-3xl border border-slate-200 bg-white p-5">
          <p className="text-xs font-black uppercase tracking-wider text-slate-400">최근 YouTube 초안</p>
          <div className="mt-3 space-y-2">
            {youtubeJobs.map((job) => (
              <div className="rounded-2xl bg-slate-50 p-3" key={job.job_id}>
                <div className="flex items-center justify-between">
                  <span className={`text-xs font-bold ${job.status === 'published' ? 'text-emerald-600' : 'text-slate-400'}`}>
                    {job.status}
                  </span>
                </div>
                <p className="mt-1 line-clamp-2 text-xs text-slate-600">{job.caption || '문안 없음'}</p>
              </div>
            ))}
            {!youtubeJobs.length && (
              <div className="flex h-24 flex-col items-center justify-center">
                <p className="text-xs text-slate-400">업로드 초안이 없습니다</p>
                <p className="mt-1 text-[11px] text-slate-300">계정 연동 후 영상 초안을 만들 수 있습니다</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
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

  const connectMutation = useMutation({
    mutationFn: async (provider: 'threads' | 'naver_blog' | 'youtube') => {
      const { authorizeUrl } = await startSocialOAuth(storeId, provider);
      window.location.href = authorizeUrl;
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: (provider: 'threads' | 'naver_blog' | 'youtube') => disconnectSocialAccount(storeId, provider),
    onSuccess: invalidate,
  });

  const providerStatus = useMemo(() => {
    return new Map((providersQuery.data || []).map((provider) => [provider.provider, provider.status]));
  }, [providersQuery.data]);
  const youtubeReadiness = useMemo(() => getYouTubeProviderReadiness(), []);
  const youtubeProvider = (providersQuery.data || []).find((provider) => provider.provider === 'youtube');
  const youtubeJobs = (jobsQuery.data || []).filter((job) => job.provider === 'youtube').slice(0, 3);
  const externalProviderCards = (providersQuery.data || []).filter((provider) =>
    ['threads', 'naver_blog', 'kakao_share'].includes(provider.provider),
  );
  const externalJobs = (jobsQuery.data || [])
    .filter((job) => ['threads', 'naver_blog', 'kakao_share'].includes(job.provider))
    .slice(0, 4);

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

      <StoreCredentialsPanel storeId={storeId} />

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

      <Panel title="Threads · Naver Blog · Kakao Share 연동" subtitle="계정을 연동하면 AI가 생성한 콘텐츠를 자동으로 발행할 수 있습니다.">
        <SocialProviderGrid
          providers={externalProviderCards}
          connectMutation={connectMutation}
          disconnectMutation={disconnectMutation}
        />
        {externalJobs.length > 0 && (
          <div className="mt-4 rounded-3xl border border-slate-100 bg-slate-50 p-5">
            <p className="text-xs font-black uppercase tracking-wider text-slate-400">최근 게시 초안</p>
            <div className="mt-3 space-y-2">
              {externalJobs.map((job) => (
                <div className="flex items-center justify-between rounded-2xl bg-white px-4 py-3 shadow-sm" key={job.job_id}>
                  <div>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-600">{job.provider}</span>
                    <p className="mt-1 line-clamp-1 text-sm text-slate-700">{job.caption || '문안 없음'}</p>
                  </div>
                  <span className={`text-xs font-bold ${job.status === 'published' ? 'text-emerald-600' : 'text-slate-400'}`}>{job.status}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </Panel>

      <Panel title="YouTube 계정 연동" subtitle="채널을 연결하면 영상 업로드와 자막 자동 등록이 가능합니다.">
        <YouTubeProviderPanel
          youtubeProvider={youtubeProvider}
          youtubeReadiness={youtubeReadiness}
          youtubeJobs={youtubeJobs}
          connectMutation={connectMutation}
          disconnectMutation={disconnectMutation}
        />
      </Panel>

      {/* ── 이 아래는 원래 YouTube 패널 코드 — 위 컴포넌트로 대체됨 (dummy anchor for diff) ── */}
      {false && <Panel title="YouTube 업로드 준비" subtitle="영상 업로드와 자막 등록은 계정 연동, 점주 승인, 업로드 설정이 모두 준비된 뒤에만 진행됩니다.">
        <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-3xl border border-slate-200 bg-white p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs font-black text-slate-500">연결 상태</p>
                <p className="mt-2 text-2xl font-black text-slate-950">{youtubeProvider?.status || 'disabled'}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {youtubeProvider?.status === 'connected' ? (
                  <button
                    className="btn-secondary text-rose-600"
                    disabled={disconnectMutation.isPending}
                    onClick={() => disconnectMutation.mutate('youtube')}
                    type="button"
                  >
                    연결 해제
                  </button>
                ) : (
                  <button
                    className="btn-secondary"
                    disabled={!youtubeReadiness.oauthReady || connectMutation.isPending}
                    onClick={() => youtubeReadiness.oauthReady && connectMutation.mutate('youtube')}
                    title={youtubeReadiness.oauthReady ? 'YouTube 계정 연동' : 'YouTube OAuth 환경 변수를 설정하세요'}
                    type="button"
                  >
                    계정 연동
                  </button>
                )}
              </div>
            </div>
            {youtubeProvider?.status === 'connected' && youtubeProvider?.displayName ? (
              <p className="mt-2 text-xs font-bold text-emerald-600">연결됨: {youtubeProvider?.displayName}</p>
            ) : null}
            <p className="mt-4 text-sm leading-6 text-slate-600">
              YouTube 영상 업로드와 자막 등록은 계정 연동과 업로드 설정 완료 후 사용할 수 있습니다.
            </p>
            {!youtubeReadiness.oauthReady ? (
              <p className="mt-2 text-xs font-bold leading-5 text-amber-700">
                설정 대기: {youtubeReadiness.missingOAuthEnvNames.join(', ')}
              </p>
            ) : null}
          </div>
          <div className="rounded-3xl border border-slate-200 bg-white p-5">
            <p className="text-xs font-black text-slate-500">필요 scope</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {YOUTUBE_REQUIRED_SCOPES.map((scope) => (
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600" key={scope}>
                  {scope}
                </span>
              ))}
            </div>
            <p className="mt-4 text-sm leading-6 text-slate-600">
              자막 업로드는 자막 파일이 준비되고 YouTube 연동이 완료되면 사용할 수 있습니다.
            </p>
          </div>
        </div>
        <div className="mt-4 rounded-3xl border border-slate-200 bg-white p-5">
          <p className="text-xs font-black text-slate-500">최근 YouTube 게시 작업</p>
          <div className="mt-3 space-y-2">
            {youtubeJobs.map((job) => (
              <div className="rounded-2xl bg-slate-50 p-3" key={job.job_id}>
                <p className="text-sm font-black text-slate-800">{job.status}</p>
                <p className="mt-1 line-clamp-2 text-sm text-slate-600">{job.caption || '문안 없음'}</p>
              </div>
            ))}
            {!youtubeJobs.length ? (
              <p className="text-sm leading-6 text-slate-500">
                아직 YouTube 업로드 초안이 없습니다. 미디어, 블로그, 수동 소스에서 승인용 초안을 만들 수 있습니다.
              </p>
            ) : null}
          </div>
        </div>
      </Panel>}

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
                {job.status === 'draft' || job.status === 'waiting_approval' ? (
                  <button className="btn-secondary" disabled={approveMutation.isPending} onClick={() => approveMutation.mutate(job.job_id)} type="button">
                    승인
                  </button>
                ) : (
                  <button className="btn-secondary" disabled type="button">
                    승인 완료
                  </button>
                )}
              </div>
            </article>
          ))}
          {!jobsQuery.data?.length ? <EmptyState title="게시 초안이 없습니다" description="리뷰, 블로그, 미디어를 바탕으로 승인용 게시 초안을 만들 수 있습니다." /> : null}
        </div>
      </Panel>
    </div>
  );
}
