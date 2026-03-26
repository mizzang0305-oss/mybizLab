import { Link } from 'react-router-dom';

import { useStorePublicContext } from '@/app/layouts/StorePublicLayout';
import { Panel } from '@/shared/components/Panel';
import { formatCurrency } from '@/shared/lib/format';
import { featureDefinitions } from '@/shared/lib/moduleCatalog';
import { getStoreBrandConfig } from '@/shared/lib/storeData';
import { getBusinessTypeLabel } from '@/shared/lib/storeLabels';
import { buildStoreUrl } from '@/shared/lib/storeSlug';

type PublicAction =
  | { kind: 'link'; label: string; to: string }
  | { kind: 'anchor'; label: string; href: string }
  | { kind: 'external'; label: string; href: string };

const heroThemeMap = {
  light: {
    panel: 'bg-slate-950 text-white',
    overlay: 'from-slate-950/85 via-slate-950/65 to-slate-950/55',
    chip: 'bg-white/12 text-white',
    accent: 'text-orange-200',
  },
  warm: {
    panel: 'bg-[#4a1f10] text-white',
    overlay: 'from-[#2a1209]/90 via-[#4a1f10]/65 to-[#7c2d12]/45',
    chip: 'bg-amber-100/20 text-amber-50',
    accent: 'text-amber-200',
  },
  modern: {
    panel: 'bg-[#052e2b] text-white',
    overlay: 'from-[#052e2b]/92 via-[#0f766e]/55 to-[#134e4a]/35',
    chip: 'bg-emerald-100/15 text-emerald-50',
    accent: 'text-emerald-200',
  },
} as const;

const publicStoreModeLabelMap = {
  order_first: '주문 중심',
  survey_first: '설문 중심',
  hybrid: '함께 안내',
  brand_inquiry_first: '문의 중심',
} as const;

const publicDataModeLabelMap = {
  order_only: '주문 안내',
  survey_only: '설문 안내',
  manual_only: '운영 안내',
  order_survey: '주문 + 후기',
  survey_manual: '후기 + 운영 안내',
  order_survey_manual: '주문 + 후기 + 운영 안내',
} as const;

function resolveStoreProfile(source: string) {
  if (source.includes('bbq') || source.includes('izakaya') || source.includes('pub') || source.includes('bar')) {
    return {
      keyPoints: ['피크 시간 좌석 안내', '추천 세트 메뉴', '단체 문의'],
      supportCopy: '저녁 피크 시간, 단체 예약, 빠른 메뉴 안내에 맞춘 공개 스토어입니다.',
    };
  }

  if (source.includes('buffet')) {
    return {
      keyPoints: ['대기 안내', '리필 인기 코너', '방문 만족도'],
      supportCopy: '대기 시간, 리필 코너, 고객 의견 흐름을 먼저 보여주는 공개 스토어입니다.',
    };
  }

  if (source.includes('coffee') || source.includes('cafe')) {
    return {
      keyPoints: ['시그니처 메뉴', '매장 분위기', '후기 남기기'],
      supportCopy: '대표 메뉴와 분위기, 고객 반응을 한눈에 소개하기 좋게 구성했습니다.',
    };
  }

  return {
    keyPoints: ['매장 소개', '빠른 이용 버튼', '고객 의견'],
    supportCopy: '매장 소개와 핵심 버튼을 간단하게 보여주는 기본 공개 화면입니다.',
  };
}

function resolveOperationStatus(openingHours?: string) {
  if (!openingHours) {
    return {
      label: '운영시간 준비 중',
      hint: '운영시간은 설정 후 표시됩니다.',
      tone: 'bg-slate-100 text-slate-700',
    };
  }

  const match = openingHours.match(/(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/);
  if (!match) {
    return {
      label: '오늘 운영시간',
      hint: openingHours,
      tone: 'bg-emerald-100 text-emerald-700',
    };
  }

  const [, startHour, startMinute, endHour, endMinute] = match;
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const startMinutes = Number(startHour) * 60 + Number(startMinute);
  const endMinutes = Number(endHour) * 60 + Number(endMinute);
  const isOpen = currentMinutes >= startMinutes && currentMinutes <= endMinutes;

  return {
    label: isOpen ? '지금 운영 중' : '영업 전/마감 후',
    hint: openingHours,
    tone: isOpen ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700',
  };
}

function getPublicStoreModeLabel(storeMode?: string | null) {
  if (!storeMode) {
    return '매장 안내';
  }

  return publicStoreModeLabelMap[storeMode as keyof typeof publicStoreModeLabelMap] || storeMode;
}

function getPublicDataModeLabel(dataMode?: string | null) {
  if (!dataMode) {
    return '기본 안내';
  }

  return publicDataModeLabelMap[dataMode as keyof typeof publicDataModeLabelMap] || dataMode;
}

function renderAction(action: PublicAction, extraClassName = '') {
  if (action.kind === 'link') {
    return (
      <Link className={extraClassName} to={action.to}>
        {action.label}
      </Link>
    );
  }

  return (
    <a className={extraClassName} href={action.href}>
      {action.label}
    </a>
  );
}

export function StoreHomePage() {
  const { publicBasePath, publicStore, tableNo } = useStorePublicContext();
  const featureLabelMap = new Map(featureDefinitions.map((feature) => [feature.key, feature.label]));
  const heroMedia = publicStore.media.find((media) => media.type === 'hero') || publicStore.media[0];
  const galleryMedia = publicStore.media.filter((media) => media.type !== 'hero');
  const config = getStoreBrandConfig(publicStore.store);
  const consultationLink = `tel:${config.phone.replace(/[^0-9+]/g, '')}`;
  const inquiryLink = `mailto:${config.email}?subject=${encodeURIComponent(`[${publicStore.store.name}] 문의`)}`;
  const reservationLink = `mailto:${config.email}?subject=${encodeURIComponent(`[${publicStore.store.name}] 예약`)}`;
  const inquiryPath = `/s/${publicStore.store.id}/inquiry`;
  const theme = heroThemeMap[publicStore.store.theme_preset || 'light'];
  const experience = publicStore.experience;
  const operationStatus = resolveOperationStatus(publicStore.location?.opening_hours);
  const latestNotice = publicStore.notices[0] || null;
  const storeProfile = resolveStoreProfile(
    `${publicStore.store.slug} ${publicStore.store.name} ${publicStore.store.business_type || ''}`.toLowerCase(),
  );
  const surveyAction: PublicAction = publicStore.surveySummary?.survey.id
    ? {
        kind: 'link',
        label: publicStore.store.mobile_cta_label || '의견 남기기',
        to: `/s/${publicStore.store.id}/survey/${publicStore.surveySummary.survey.id}${tableNo ? `?tableCode=${encodeURIComponent(tableNo)}` : ''}`,
      }
    : {
        kind: 'anchor',
        label: publicStore.store.mobile_cta_label || '의견 남기기',
        href: '#customer-voice',
      };
  const inquiryAction: PublicAction = { kind: 'link', label: '문의 남기기', to: inquiryPath };
  const orderAction: PublicAction = {
    kind: 'link',
    label: publicStore.store.primary_cta_label || '주문 시작하기',
    to: `${publicBasePath}/order${tableNo ? `?table=${tableNo}` : ''}`,
  };
  const primaryAction =
    publicStore.store.preview_target === 'inquiry'
      ? inquiryAction
      : publicStore.store.preview_target === 'survey' || !publicStore.capabilities.orderEntryEnabled
        ? surveyAction
        : orderAction;

  return (
    <div className="space-y-8">
      <section className="grid gap-6 xl:grid-cols-[1.12fr_0.88fr]">
        <div className={`relative overflow-hidden rounded-[36px] ${theme.panel} shadow-[0_35px_90px_-45px_rgba(15,23,42,0.8)]`}>
          {heroMedia ? <img alt={heroMedia.title} className="absolute inset-0 h-full w-full object-cover" src={heroMedia.image_url} /> : null}
          <div className={`absolute inset-0 bg-gradient-to-br ${theme.overlay}`} />
          <div className="relative flex h-full flex-col gap-6 px-6 py-7 sm:px-8 sm:py-10">
            <div className="rounded-[28px] border border-white/15 bg-white/10 p-4 backdrop-blur">
              <p className={`text-xs font-semibold uppercase tracking-[0.24em] ${theme.accent}`}>{experience.eyebrow}</p>
              <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-3">
                  <h2 className="font-display text-3xl font-black tracking-tight sm:text-5xl">{publicStore.store.name}</h2>
                  <p className="max-w-2xl text-sm leading-7 text-white/85 sm:text-base">{publicStore.store.tagline}</p>
                </div>
                <span className={`inline-flex w-fit rounded-full px-3 py-1 text-xs font-bold ${theme.chip}`}>
                  {getPublicStoreModeLabel(publicStore.store.store_mode)} · {getPublicDataModeLabel(publicStore.store.data_mode)}
                </span>
              </div>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-white/80">{publicStore.store.description}</p>
            </div>

            <div className="rounded-[28px] border border-white/15 bg-white/10 p-4 backdrop-blur">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-white/80">오늘 안내</p>
                  <p className="mt-2 text-xl font-bold">{experience.eventTitle}</p>
                  <p className="mt-2 max-w-xl text-sm leading-6 text-white/75">{experience.eventDescription}</p>
                </div>
                <a className="btn-secondary border-white/15 bg-white/5 text-white hover:bg-white hover:text-slate-900" href="#notice-board">
                  공지 보기
                </a>
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              {renderAction(primaryAction, 'btn-primary flex-1 justify-center')}
              <Link className="btn-secondary flex-1 justify-center border-white/15 bg-white/5 text-white hover:bg-white hover:text-slate-900" to={`${publicBasePath}/menu`}>
                메뉴 보기
              </Link>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              {storeProfile.keyPoints.map((point) => (
                <div className="rounded-3xl border border-white/15 bg-white/10 px-4 py-4 text-sm font-semibold text-white/85" key={point}>
                  {point}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="grid gap-4">
          <Panel title="점주용 요약" subtitle="처음 보는 손님도 바로 이해할 수 있게 핵심 정보만 간단히 정리했습니다.">
            <div className="grid gap-4">
              <div className="rounded-[28px] border border-slate-200 bg-white p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span className={`rounded-full px-3 py-1 text-xs font-bold ${operationStatus.tone}`}>{operationStatus.label}</span>
                  {publicStore.store.public_status !== 'public' ? (
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">미리보기 전용</span>
                  ) : null}
                </div>
                <p className="mt-4 text-lg font-bold text-slate-900">{operationStatus.hint}</p>
                <p className="mt-2 text-sm leading-6 text-slate-500">{storeProfile.supportCopy}</p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-[28px] border border-slate-200 bg-white p-5">
                  <p className="text-sm font-semibold text-slate-500">진행 중 설문</p>
                  <p className="mt-3 text-3xl font-black text-slate-900">{publicStore.surveySummary?.responseCount ?? 0}</p>
                  <p className="mt-2 text-sm text-slate-500">
                    {publicStore.surveySummary
                      ? `최근 응답 기준 평균 만족도는 ${publicStore.surveySummary.averageRating} / 5점입니다.`
                      : '설문이 열리기 전에도 고객 의견 받기 버튼을 먼저 보여줄 수 있습니다.'}
                  </p>
                </div>
                <div className="rounded-[28px] border border-slate-200 bg-white p-5">
                  <p className="text-sm font-semibold text-slate-500">문의 흐름</p>
                  <p className="mt-3 text-3xl font-black text-slate-900">{publicStore.inquirySummary.openCount}</p>
                  <p className="mt-2 text-sm text-slate-500">
                    {publicStore.inquirySummary.totalCount
                      ? `${publicStore.inquirySummary.totalCount}건의 문의가 이미 CRM과 대시보드 후속 응대로 연결되어 있습니다.`
                      : '첫 문의가 들어오기 전에도 문의 동선을 먼저 안내할 수 있습니다.'}
                  </p>
                </div>
              </div>
            </div>
          </Panel>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <Panel title={experience.todayLabel} subtitle="처음 방문한 손님도 바로 고를 수 있게 오늘 추천 메뉴를 정리했습니다.">
          <div className="grid gap-4">
            {publicStore.menuHighlights.today.map((item, index) => (
              <div className="rounded-[30px] border border-slate-200 bg-white p-5" key={item.id}>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <span className="rounded-full bg-orange-100 px-3 py-1 text-xs font-bold text-orange-700">오늘 추천 {index + 1}</span>
                    <p className="mt-3 text-xl font-bold text-slate-900">{item.name}</p>
                    <p className="mt-2 text-sm leading-6 text-slate-500">{item.description}</p>
                  </div>
                  <p className="font-display text-2xl font-black text-slate-900">{formatCurrency(item.price)}</p>
                </div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title={experience.weeklyLabel} subtitle="이번 주에 많이 찾는 메뉴를 한 번 더 보여주는 추천 영역입니다.">
          <div className="grid gap-4">
            {publicStore.menuHighlights.weekly.map((item, index) => (
              <div className="rounded-[30px] border border-slate-200 bg-white p-5" key={item.id}>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">이번 주 추천 {index + 1}</span>
                    <p className="mt-3 text-xl font-bold text-slate-900">{item.name}</p>
                    <p className="mt-2 text-sm leading-6 text-slate-500">{item.description}</p>
                  </div>
                  <div className="text-right">
                    {item.is_popular ? <p className="text-xs font-bold uppercase tracking-[0.2em] text-orange-600">인기</p> : null}
                    <p className="mt-2 font-display text-2xl font-black text-slate-900">{formatCurrency(item.price)}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr_0.95fr]">
        <Panel title="매장 안내와 공지" subtitle="방문 전에 꼭 확인해야 할 안내를 한곳에 모았습니다.">
          <div className="grid gap-4" id="notice-board">
            {latestNotice ? (
              publicStore.notices.map((notice) => (
                <div className="rounded-[28px] border border-slate-200 bg-white p-5" key={notice.id}>
                  <div className="flex items-center gap-2">
                    {notice.is_pinned ? <span className="rounded-full bg-orange-100 px-3 py-1 text-xs font-bold text-orange-700">중요 안내</span> : null}
                    <span className="text-xs text-slate-400">{new Date(notice.published_at).toLocaleDateString('ko-KR')}</span>
                  </div>
                  <p className="mt-3 text-lg font-bold text-slate-900">{notice.title}</p>
                  <p className="mt-2 text-sm leading-7 text-slate-600">{notice.content}</p>
                </div>
              ))
            ) : (
              <div className="rounded-[28px] border border-dashed border-slate-200 bg-slate-50 p-5 text-sm text-slate-500">
                아직 등록된 공지가 없습니다. 필요한 안내는 이 영역에 바로 추가됩니다.
              </div>
            )}
          </div>
        </Panel>

        <Panel title={experience.surveyLabel} subtitle="식사나 방문 후 의견을 남길 수 있는 고객용 버튼 영역입니다.">
          <div className="flex h-full flex-col justify-between gap-4 rounded-[30px] border border-slate-200 bg-white p-5" id="customer-voice">
            <div>
              <p className="text-sm font-semibold text-slate-500">{publicStore.surveySummary?.survey.title || '고객 의견 남기기'}</p>
              <p className="mt-3 text-3xl font-black text-slate-900">{publicStore.surveySummary?.averageRating ?? 0}</p>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                {publicStore.surveySummary
                  ? `${publicStore.surveySummary.responseCount}건의 응답이 대시보드와 AI 운영 화면에 함께 반영됩니다.`
                  : '설문이 열리기 전에도 고객 의견 버튼을 먼저 배치해 둘 수 있습니다.'}
              </p>
            </div>
            {renderAction(surveyAction, 'btn-primary justify-center')}
          </div>
        </Panel>

        <Panel title={experience.inquiryLabel} subtitle="예약, 상담, 문의를 주문 흐름과 분리해 안내하는 영역입니다.">
          <div className="flex h-full flex-col justify-between gap-4 rounded-[30px] border border-slate-200 bg-white p-5" id="contact-section">
            <div className="space-y-3 text-sm leading-6 text-slate-600">
              <p>
                <span className="font-semibold text-slate-900">전화</span>
                <br />
                {config.phone || '전화번호 준비 중'}
              </p>
              <p>
                <span className="font-semibold text-slate-900">이메일</span>
                <br />
                {config.email || '이메일 준비 중'}
              </p>
              <p>
                <span className="font-semibold text-slate-900">이용 안내</span>
                <br />
                상담, 예약, 브랜드 문의를 주문이나 설문과 구분해 바로 안내합니다.
              </p>
              {publicStore.inquirySummary.recentTags.length ? (
                <p>
                  <span className="font-semibold text-slate-900">최근 문의 주제</span>
                  <br />
                  {publicStore.inquirySummary.recentTags.join(' / ')}
                </p>
              ) : null}
            </div>
            <div className="grid gap-3">
              <Link className="btn-primary justify-center" to={inquiryPath}>
                문의하기
              </Link>
              <a className="btn-secondary justify-center" href={consultationLink}>
                전화하기
              </a>
              <a className="btn-secondary justify-center" href={inquiryLink}>
                이메일 문의
              </a>
              <a className="btn-secondary justify-center" href={reservationLink}>
                예약하기
              </a>
            </div>
          </div>
        </Panel>
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.94fr_1.06fr]">
        <Panel title="매장 분위기" subtitle="사진과 분위기를 먼저 보여줘 처음 방문한 손님도 편하게 이해할 수 있게 했습니다.">
          <div className="grid gap-4 sm:grid-cols-2">
            {galleryMedia.length ? (
              galleryMedia.map((media) => (
                <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_20px_45px_-35px_rgba(15,23,42,0.45)]" key={media.id}>
                  <img alt={media.title} className="h-48 w-full object-cover" src={media.image_url} />
                  <div className="p-4">
                    <p className="font-semibold text-slate-900">{media.title}</p>
                    <p className="mt-1 text-sm leading-6 text-slate-500">{media.caption}</p>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-[28px] border border-dashed border-slate-200 bg-slate-50 p-5 text-sm text-slate-500">
                사진이 없어도 이 영역에서 매장 분위기를 먼저 소개할 수 있습니다.
              </div>
            )}
          </div>
        </Panel>

        <Panel title="방문 정보와 빠른 이동" subtitle="주소, 운영시간, 사용 중 기능, QR 주문 링크를 한곳에서 확인할 수 있습니다.">
          <div className="grid gap-4">
            <div className="rounded-[28px] border border-slate-200 bg-white p-5 text-sm leading-7 text-slate-600">
              <p>
                <span className="font-semibold text-slate-900">업종</span>
                <br />
                {getBusinessTypeLabel(config.business_type)}
              </p>
              <p className="mt-3">
                <span className="font-semibold text-slate-900">주소</span>
                <br />
                {publicStore.location?.address || config.address || '-'}
              </p>
              <p className="mt-3">
                <span className="font-semibold text-slate-900">운영시간</span>
                <br />
                {publicStore.location?.opening_hours || '운영시간은 설정 후 표시됩니다.'}
              </p>
              <p className="mt-3">
                <span className="font-semibold text-slate-900">찾아오는 길</span>
                <br />
                {publicStore.location?.directions || '찾아오는 길은 설정 후 표시됩니다.'}
              </p>
              {publicStore.location?.parking_note ? (
                <p className="mt-3">
                  <span className="font-semibold text-slate-900">주차</span>
                  <br />
                  {publicStore.location.parking_note}
                </p>
              ) : null}
              <p className="mt-3 break-all text-xs text-slate-400">{buildStoreUrl(publicStore.store.slug)}</p>
            </div>

            <div className="rounded-[28px] border border-slate-200 bg-white p-5">
              <p className="text-sm font-semibold text-slate-500">사용 중 기능</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {publicStore.features.map((feature) => (
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700" key={feature.id}>
                    {featureLabelMap.get(feature.feature_key) || feature.feature_key}
                  </span>
                ))}
              </div>
            </div>

            <div className="rounded-[28px] border border-slate-200 bg-white p-5">
              <p className="text-sm font-semibold text-slate-500">테이블과 QR 주문</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                {publicStore.tables.map((table) => (
                  <div className="rounded-3xl bg-slate-50 p-4" key={table.id}>
                    <p className="font-bold text-slate-900">테이블 {table.table_no}</p>
                    <p className="mt-1 text-sm text-slate-500">{table.seats}인석</p>
                    <Link className="mt-3 inline-flex text-sm font-bold text-orange-700" to={`${publicBasePath}/order?table=${table.table_no}`}>
                      QR 주문 바로가기
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Panel>
      </section>
    </div>
  );
}
