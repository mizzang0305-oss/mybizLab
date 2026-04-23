import { Link } from 'react-router-dom';

import { useStorePublicContext } from '@/app/layouts/StorePublicLayout';
import { Panel } from '@/shared/components/Panel';
import { formatCurrency } from '@/shared/lib/format';
import { featureDefinitions } from '@/shared/lib/moduleCatalog';
import { getStoreBrandConfig } from '@/shared/lib/storeData';
import { getBusinessTypeLabel } from '@/shared/lib/storeLabels';
import { buildStoreUrl } from '@/shared/lib/storeSlug';

const heroThemeMap = {
  light: {
    panel: 'bg-slate-950 text-white',
    overlay: 'from-slate-950/88 via-slate-950/64 to-slate-950/48',
    chip: 'bg-white/12 text-white',
    accent: 'text-orange-200',
  },
  modern: {
    panel: 'bg-[#052e2b] text-white',
    overlay: 'from-[#052e2b]/92 via-[#0f766e]/58 to-[#134e4a]/38',
    chip: 'bg-emerald-100/15 text-emerald-50',
    accent: 'text-emerald-200',
  },
  warm: {
    panel: 'bg-[#4a1f10] text-white',
    overlay: 'from-[#2a1209]/90 via-[#4a1f10]/70 to-[#7c2d12]/46',
    chip: 'bg-amber-100/20 text-amber-50',
    accent: 'text-amber-200',
  },
} as const;

function formatOpeningHours(openingHours?: string) {
  return openingHours?.trim() || '운영 시간은 매장 확인 후 안내됩니다.';
}

export function StoreHomePage() {
  const { publicBasePath, publicStore, tableNo } = useStorePublicContext();
  const theme = heroThemeMap[publicStore.store.theme_preset || 'light'];
  const heroMedia = publicStore.media.find((media) => media.type === 'hero') || publicStore.media[0];
  const galleryMedia = publicStore.media.filter((media) => media.type !== 'hero');
  const config = getStoreBrandConfig(publicStore.store);
  const featureLabelMap = new Map(featureDefinitions.map((feature) => [feature.key, feature.label]));
  const surveyPath = publicStore.surveySummary?.survey.id
    ? `/s/${publicStore.store.id}/survey/${publicStore.surveySummary.survey.id}${tableNo ? `?tableCode=${encodeURIComponent(tableNo)}` : ''}`
    : null;
  const inquiryPath = `/s/${publicStore.store.id}/inquiry`;
  const reservationPath = `/s/${publicStore.store.id}/reservation`;
  const waitingPath = `/s/${publicStore.store.id}/waiting`;
  const waitingEnabled = publicStore.capabilities.waitingEnabled;
  const canOrder = publicStore.capabilities.orderEntryEnabled;
  const canReserve = publicStore.capabilities.reservationEnabled;
  const canInquire = publicStore.capabilities.inquiryEnabled;

  return (
    <div className="space-y-8">
      <section className="grid gap-6 xl:grid-cols-[1.12fr_0.88fr]">
        <div className={`relative overflow-hidden rounded-[36px] ${theme.panel} shadow-[0_35px_90px_-45px_rgba(15,23,42,0.8)]`}>
          {heroMedia ? (
            <img alt={heroMedia.title} className="absolute inset-0 h-full w-full object-cover" src={heroMedia.image_url} />
          ) : null}
          <div className={`absolute inset-0 bg-gradient-to-br ${theme.overlay}`} />
          <div className="relative flex h-full flex-col gap-6 px-6 py-7 sm:px-8 sm:py-10">
            <div className="rounded-[28px] border border-white/15 bg-white/10 p-4 backdrop-blur">
              <p className={`text-xs font-semibold uppercase tracking-[0.24em] ${theme.accent}`}>고객 메모리 공개 스토어</p>
              <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-3">
                  <h2 className="font-display text-3xl font-black tracking-tight sm:text-5xl">{publicStore.store.name}</h2>
                  <p className="max-w-2xl text-sm leading-7 text-white/85 sm:text-base">{publicStore.store.tagline}</p>
                </div>
                <span className={`inline-flex w-fit rounded-full px-3 py-1 text-xs font-bold ${theme.chip}`}>
                  {getBusinessTypeLabel(config.business_type)} · {publicStore.store.public_status === 'public' ? '공개 운영 중' : '미리보기'}
                </span>
              </div>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-white/80">
                {publicStore.store.description}
              </p>
            </div>

            <div className="rounded-[28px] border border-white/15 bg-white/10 p-4 backdrop-blur">
              <p className="text-sm font-semibold text-white/85">이 매장에서 받는 입력 채널</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {canInquire ? <span className="rounded-full bg-white/12 px-3 py-1 text-xs font-bold text-white">문의</span> : null}
                {canReserve ? <span className="rounded-full bg-white/12 px-3 py-1 text-xs font-bold text-white">예약</span> : null}
                {waitingEnabled ? <span className="rounded-full bg-white/12 px-3 py-1 text-xs font-bold text-white">웨이팅</span> : null}
                {canOrder ? <span className="rounded-full bg-white/12 px-3 py-1 text-xs font-bold text-white">주문</span> : null}
                {surveyPath ? <span className="rounded-full bg-white/12 px-3 py-1 text-xs font-bold text-white">후기</span> : null}
              </div>
              <p className="mt-3 text-sm leading-6 text-white/75">
                들어온 기록은 고객 메모리와 운영 타임라인으로 이어지고, 이후 재방문과 후속 응대 판단에 활용됩니다.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {canOrder ? (
                <Link className="btn-primary justify-center" to={`${publicBasePath}/order${tableNo ? `?table=${tableNo}` : ''}`}>
                  주문 시작하기
                </Link>
              ) : null}
              <Link className="btn-secondary justify-center border-white/15 bg-white/5 text-white hover:bg-white hover:text-slate-900" to={`${publicBasePath}/menu`}>
                메뉴 보기
              </Link>
              {canInquire ? (
                <Link className="btn-secondary justify-center border-white/15 bg-white/5 text-white hover:bg-white hover:text-slate-900" to={inquiryPath}>
                  문의 남기기
                </Link>
              ) : null}
              {canReserve ? (
                <Link className="btn-secondary justify-center border-white/15 bg-white/5 text-white hover:bg-white hover:text-slate-900" to={reservationPath}>
                  예약 신청
                </Link>
              ) : null}
              {waitingEnabled ? (
                <Link className="btn-secondary justify-center border-white/15 bg-white/5 text-white hover:bg-white hover:text-slate-900" to={waitingPath}>
                  웨이팅 등록
                </Link>
              ) : null}
              {surveyPath ? (
                <Link className="btn-secondary justify-center border-white/15 bg-white/5 text-white hover:bg-white hover:text-slate-900" to={surveyPath}>
                  고객 의견 남기기
                </Link>
              ) : null}
            </div>
          </div>
        </div>

        <div className="grid gap-4">
          <Panel title="지금 확인할 흐름" subtitle="매장 유입이 어느 채널로 연결되는지 먼저 보여드립니다.">
            <div className="grid gap-4">
              <div className="rounded-[28px] border border-slate-200 bg-white p-5">
                <p className="text-sm font-semibold text-slate-500">문의 흐름</p>
                <p className="mt-3 text-3xl font-black text-slate-900">{publicStore.inquirySummary.openCount}</p>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  {publicStore.inquirySummary.totalCount
                    ? `${publicStore.inquirySummary.totalCount}건의 문의가 이미 고객 메모리와 후속 응대 흐름으로 연결되었습니다.`
                    : '첫 문의가 들어오기 전에도 문의 채널을 먼저 열어 둘 수 있습니다.'}
                </p>
              </div>

              <div className="rounded-[28px] border border-slate-200 bg-white p-5">
                <p className="text-sm font-semibold text-slate-500">고객 의견</p>
                <p className="mt-3 text-3xl font-black text-slate-900">{publicStore.surveySummary?.responseCount ?? 0}</p>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  {publicStore.surveySummary
                    ? `최근 응답 평균 만족도는 ${publicStore.surveySummary.averageRating} / 5점입니다.`
                    : '후기 채널이 열리면 고객 반응이 바로 운영 리포트에 반영됩니다.'}
                </p>
              </div>

              <div className="rounded-[28px] border border-slate-200 bg-white p-5">
                <p className="text-sm font-semibold text-slate-500">방문 정보</p>
                <p className="mt-3 text-lg font-bold text-slate-900">{publicStore.location?.address || config.address || '주소 준비 중'}</p>
                <p className="mt-2 text-sm leading-6 text-slate-500">{formatOpeningHours(publicStore.location?.opening_hours)}</p>
              </div>
            </div>
          </Panel>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <Panel title="오늘 추천 메뉴" subtitle="처음 방문한 고객도 바로 이해할 수 있게 핵심 메뉴만 먼저 보여드립니다.">
          <div className="grid gap-4">
            {(publicStore.menuHighlights.today.length ? publicStore.menuHighlights.today : publicStore.menuHighlights.weekly).map((item, index) => (
              <div className="rounded-[30px] border border-slate-200 bg-white p-5" key={item.id}>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <span className="rounded-full bg-orange-100 px-3 py-1 text-xs font-bold text-orange-700">추천 {index + 1}</span>
                    <p className="mt-3 text-xl font-bold text-slate-900">{item.name}</p>
                    <p className="mt-2 text-sm leading-6 text-slate-500">{item.description}</p>
                  </div>
                  <p className="font-display text-2xl font-black text-slate-900">{formatCurrency(item.price)}</p>
                </div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="입력 채널과 운영 연결" subtitle="고객 입력이 어디로 연결되는지 한 눈에 확인할 수 있습니다.">
          <div className="grid gap-4">
            <div className="rounded-[28px] border border-slate-200 bg-white p-5">
              <p className="text-sm font-semibold text-slate-500">문의 → 고객 메모리</p>
              <p className="mt-2 text-sm leading-7 text-slate-600">
                문의 내용은 고객 카드와 타임라인으로 연결되어 이후 후속 응대와 요약에 활용됩니다.
              </p>
            </div>
            <div className="rounded-[28px] border border-slate-200 bg-white p-5">
              <p className="text-sm font-semibold text-slate-500">예약 / 웨이팅 → 운영 동선</p>
              <p className="mt-2 text-sm leading-7 text-slate-600">
                예약과 웨이팅이 켜져 있다면 방문 전 흐름부터 좌석 운영까지 한 축으로 기록됩니다.
              </p>
            </div>
            <div className="rounded-[28px] border border-slate-200 bg-white p-5">
              <p className="text-sm font-semibold text-slate-500">주문 / 후기 → 재방문 판단</p>
              <p className="mt-2 text-sm leading-7 text-slate-600">
                주문 반응과 후기 데이터는 다음 추천, 재방문 대응, 운영 리포트의 근거가 됩니다.
              </p>
            </div>
          </div>
        </Panel>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr_0.95fr]">
        <Panel title="매장 안내와 공지" subtitle="방문 전에 꼭 알아야 할 정보만 모았습니다.">
          <div className="grid gap-4">
            {publicStore.notices.length ? (
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
                아직 등록된 공지가 없습니다. 운영 전 필요한 안내를 이 영역에 정리할 수 있습니다.
              </div>
            )}
          </div>
        </Panel>

        <Panel title="고객 의견과 문의" subtitle="공개 유입을 실제 고객 메모리 축으로 연결하는 버튼입니다.">
          <div className="flex h-full flex-col justify-between gap-4 rounded-[30px] border border-slate-200 bg-white p-5">
            <div className="space-y-3 text-sm leading-6 text-slate-600">
              <p>
                <span className="font-semibold text-slate-900">최근 문의 주제</span>
                <br />
                {publicStore.inquirySummary.recentTags.length ? publicStore.inquirySummary.recentTags.join(' / ') : '아직 문의가 없으면 첫 입력부터 차곡차곡 쌓입니다.'}
              </p>
              <p>
                <span className="font-semibold text-slate-900">후기 응답</span>
                <br />
                {publicStore.surveySummary ? `${publicStore.surveySummary.responseCount}건` : '아직 없음'}
              </p>
            </div>
            <div className="grid gap-3">
              {canInquire ? (
                <Link className="btn-primary justify-center" to={inquiryPath}>
                  문의 남기기
                </Link>
              ) : null}
              {surveyPath ? (
                <Link className="btn-secondary justify-center" to={surveyPath}>
                  고객 의견 남기기
                </Link>
              ) : null}
              {canReserve ? (
                <Link className="btn-secondary justify-center" to={reservationPath}>
                  예약 신청
                </Link>
              ) : null}
              {waitingEnabled ? (
                <Link className="btn-secondary justify-center" to={waitingPath}>
                  웨이팅 등록
                </Link>
              ) : null}
            </div>
          </div>
        </Panel>

        <Panel title="방문 정보" subtitle="주소, 운영 시간, 기능 상태를 빠르게 확인할 수 있습니다.">
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
                <span className="font-semibold text-slate-900">운영 시간</span>
                <br />
                {formatOpeningHours(publicStore.location?.opening_hours)}
              </p>
              <p className="mt-3">
                <span className="font-semibold text-slate-900">찾아오는 길</span>
                <br />
                {publicStore.location?.directions || '찾아오는 길은 매장 안내에 맞춰 준비됩니다.'}
              </p>
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

            {publicStore.tables.length ? (
              <div className="rounded-[28px] border border-slate-200 bg-white p-5">
                <p className="text-sm font-semibold text-slate-500">테이블과 주문 진입</p>
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  {publicStore.tables.map((table) => (
                    <div className="rounded-3xl bg-slate-50 p-4" key={table.id}>
                      <p className="font-bold text-slate-900">테이블 {table.table_no}</p>
                      <p className="mt-1 text-sm text-slate-500">{table.seats}인석</p>
                      <Link className="mt-3 inline-flex text-sm font-bold text-orange-700" to={`${publicBasePath}/order?table=${table.table_no}`}>
                        주문 바로가기
                      </Link>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </Panel>
      </section>

      {galleryMedia.length ? (
        <section>
          <Panel title="매장 분위기" subtitle="첫 방문 전에 공간 감각을 바로 확인할 수 있습니다.">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {galleryMedia.map((media) => (
                <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_20px_45px_-35px_rgba(15,23,42,0.45)]" key={media.id}>
                  <img alt={media.title} className="h-48 w-full object-cover" src={media.image_url} />
                  <div className="p-4">
                    <p className="font-semibold text-slate-900">{media.title}</p>
                    <p className="mt-1 text-sm leading-6 text-slate-500">{media.caption}</p>
                  </div>
                </div>
              ))}
            </div>
          </Panel>
        </section>
      ) : null}
    </div>
  );
}
