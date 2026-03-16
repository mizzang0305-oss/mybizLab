import { Link } from 'react-router-dom';

import { useStorePublicContext } from '@/app/layouts/StorePublicLayout';
import { Panel } from '@/shared/components/Panel';
import { featureDefinitions } from '@/shared/lib/moduleCatalog';
import { buildStorePath, buildStoreUrl } from '@/shared/lib/storeSlug';

export function StoreHomePage() {
  const { publicStore, tableNo } = useStorePublicContext();
  const featureLabelMap = new Map(featureDefinitions.map((feature) => [feature.key, feature.label]));
  const heroMedia = publicStore.media.find((media) => media.type === 'hero') || publicStore.media[0];
  const galleryMedia = publicStore.media.filter((media) => media.type !== 'hero');
  const consultationLink = `tel:${publicStore.store.phone.replace(/[^0-9+]/g, '')}`;
  const inquiryLink = `mailto:${publicStore.store.email}?subject=${encodeURIComponent(`[${publicStore.store.name}] 문의`)}`;
  const reservationLink = `mailto:${publicStore.store.email}?subject=${encodeURIComponent(`[${publicStore.store.name}] 예약 문의`)}`;

  return (
    <div className="space-y-8">
      <section className="grid gap-8 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="relative overflow-hidden rounded-[36px] bg-slate-950 px-8 py-10 text-white shadow-[0_35px_90px_-45px_rgba(15,23,42,0.8)]">
          {heroMedia ? <img alt={heroMedia.title} className="absolute inset-0 h-full w-full object-cover opacity-45" src={heroMedia.image_url} /> : null}
          <div className="relative max-w-2xl space-y-5">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-orange-200">{publicStore.store.slug}</p>
            <div className="space-y-3">
              <h2 className="font-display text-4xl font-black tracking-tight sm:text-5xl">{publicStore.store.name}</h2>
              <p className="max-w-xl text-base leading-7 text-slate-200">{publicStore.store.tagline}</p>
            </div>
            <p className="max-w-2xl text-sm leading-7 text-slate-200">{publicStore.store.description}</p>

            <div className="flex flex-wrap gap-3">
              {publicStore.capabilities.consultationEnabled ? (
                <a className="btn-primary" href={consultationLink}>
                  상담하기
                </a>
              ) : null}
              {publicStore.capabilities.inquiryEnabled ? (
                <a className="btn-secondary border-white/15 bg-white/5 text-white hover:bg-white hover:text-slate-900" href={inquiryLink}>
                  문의하기
                </a>
              ) : null}
              {publicStore.capabilities.reservationEnabled ? (
                <a className="btn-secondary border-white/15 bg-white/5 text-white hover:bg-white hover:text-slate-900" href={reservationLink}>
                  예약 문의
                </a>
              ) : null}
              {publicStore.capabilities.orderEntryEnabled ? (
                <Link
                  className="btn-secondary border-white/15 bg-white/5 text-white hover:bg-white hover:text-slate-900"
                  to={`${buildStorePath(publicStore.store.slug, 'order')}${tableNo ? `?table=${tableNo}` : ''}`}
                >
                  주문 바로가기
                </Link>
              ) : null}
            </div>

            <div className="flex flex-wrap gap-2">
              {publicStore.features.map((feature) => (
                <span className="rounded-full bg-white/12 px-3 py-1 text-xs font-bold text-slate-100" key={feature.id}>
                  {featureLabelMap.get(feature.feature_key) || feature.feature_key.replace(/_/g, ' ')}
                </span>
              ))}
            </div>
          </div>
        </div>

        <Panel title="스토어 정보" subtitle="공개 스토어에서 바로 확인해야 할 위치, 운영 시간, 연락처를 정리했습니다.">
          <div className="space-y-3 text-sm leading-7 text-slate-600">
            <p>업종: {publicStore.store.business_type}</p>
            <p>연락처: {publicStore.store.phone}</p>
            <p>이메일: {publicStore.store.email}</p>
            <p>주소: {publicStore.location?.address || publicStore.store.address}</p>
            <p>운영 시간: {publicStore.location?.opening_hours || '운영 시간을 준비 중입니다.'}</p>
            <p>오시는 길: {publicStore.location?.directions || '매장 안내를 준비 중입니다.'}</p>
            {publicStore.location?.parking_note ? <p>주차 안내: {publicStore.location.parking_note}</p> : null}
            <p className="break-all">공개 주소: {buildStoreUrl(publicStore.store.slug)}</p>
          </div>
        </Panel>
      </section>

      <Panel title="공지 및 방문 안내" subtitle="고객이 방문 전에 꼭 알아야 할 운영 공지를 먼저 보여줍니다.">
        <div className="grid gap-4 lg:grid-cols-2">
          {publicStore.notices.length ? (
            publicStore.notices.map((notice) => (
              <div className="rounded-[30px] border border-slate-200 bg-white p-5" key={notice.id}>
                <div className="flex items-center gap-2">
                  {notice.is_pinned ? <span className="rounded-full bg-orange-100 px-3 py-1 text-xs font-bold text-orange-700">중요 공지</span> : null}
                  <span className="text-xs text-slate-400">{new Date(notice.published_at).toLocaleDateString('ko-KR')}</span>
                </div>
                <p className="mt-3 text-lg font-bold text-slate-900">{notice.title}</p>
                <p className="mt-2 text-sm leading-7 text-slate-600">{notice.content}</p>
              </div>
            ))
          ) : (
            <div className="rounded-[30px] border border-dashed border-slate-200 bg-slate-50 p-5 text-sm text-slate-500">
              아직 등록된 공지가 없습니다.
            </div>
          )}
        </div>
      </Panel>

      <section className="grid gap-8 xl:grid-cols-[0.95fr_1.05fr]">
        <Panel title="스토어 비주얼" subtitle="매장 분위기와 방문 경험을 전달하는 이미지 영역입니다.">
          <div className="grid gap-4 sm:grid-cols-2">
            {galleryMedia.length ? (
              galleryMedia.map((media, index) => (
                <div
                  className={`overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_20px_45px_-35px_rgba(15,23,42,0.45)] ${
                    index % 2 === 0 ? 'sm:rotate-[-2deg]' : 'sm:translate-y-6 sm:rotate-[2deg]'
                  }`}
                  key={media.id}
                >
                  <img alt={media.title} className="h-48 w-full object-cover" src={media.image_url} />
                  <div className="p-4">
                    <p className="font-semibold text-slate-900">{media.title}</p>
                    <p className="mt-1 text-sm leading-6 text-slate-500">{media.caption}</p>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-[28px] border border-dashed border-slate-200 bg-slate-50 p-5 text-sm text-slate-500">
                스토어 비주얼을 준비 중입니다.
              </div>
            )}
          </div>
        </Panel>

        <Panel title="빠른 진입" subtitle="상담, 문의, 예약, 메뉴, 주문 등 실제 전환 행동으로 이어지는 버튼을 모았습니다.">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-[30px] border border-slate-200 bg-white p-5">
              <p className="text-sm font-semibold text-slate-500">방문 전 문의</p>
              <div className="mt-4 flex flex-wrap gap-3">
                {publicStore.capabilities.consultationEnabled ? (
                  <a className="btn-primary" href={consultationLink}>
                    전화 상담
                  </a>
                ) : null}
                {publicStore.capabilities.inquiryEnabled ? (
                  <a className="btn-secondary" href={inquiryLink}>
                    이메일 문의
                  </a>
                ) : null}
                {publicStore.capabilities.reservationEnabled ? (
                  <a className="btn-secondary" href={reservationLink}>
                    예약 문의
                  </a>
                ) : null}
              </div>
            </div>

            <div className="rounded-[30px] border border-slate-200 bg-white p-5">
              <p className="text-sm font-semibold text-slate-500">메뉴 및 주문</p>
              <div className="mt-4 flex flex-wrap gap-3">
                <Link className="btn-secondary" to={buildStorePath(publicStore.store.slug, 'menu')}>
                  메뉴 보기
                </Link>
                {publicStore.capabilities.orderEntryEnabled ? (
                  <Link className="btn-primary" to={`${buildStorePath(publicStore.store.slug, 'order')}${tableNo ? `?table=${tableNo}` : ''}`}>
                    주문하기
                  </Link>
                ) : null}
              </div>
            </div>

            <div className="rounded-[30px] border border-slate-200 bg-white p-5 md:col-span-2">
              <p className="text-sm font-semibold text-slate-500">테이블 / QR 주문 정보</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                {publicStore.tables.map((table) => (
                  <div className="rounded-3xl bg-slate-50 p-4" key={table.id}>
                    <p className="font-bold text-slate-900">Table {table.table_no}</p>
                    <p className="mt-1 text-sm text-slate-500">{table.seats} seats</p>
                    <Link className="mt-3 inline-flex text-sm font-bold text-orange-700" to={`${buildStorePath(publicStore.store.slug, 'order')}?table=${table.table_no}`}>
                      QR 주문 링크
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
