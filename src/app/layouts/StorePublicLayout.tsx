import { useQuery } from '@tanstack/react-query';
import { Link, NavLink, Outlet, useOutletContext, useParams, useSearchParams } from 'react-router-dom';

import { AppFooter } from '@/shared/components/AppFooter';
import { EmptyState } from '@/shared/components/EmptyState';
import { usePageMeta } from '@/shared/hooks/usePageMeta';
import { queryKeys } from '@/shared/lib/queryKeys';
import { getStoreBrandConfig } from '@/shared/lib/storeData';
import { getPublicStore, getPublicStoreById } from '@/shared/lib/services/mvpService';
import { buildStoreIdPath, buildStorePath } from '@/shared/lib/storeSlug';

type PublicStoreSnapshot = NonNullable<Awaited<ReturnType<typeof getPublicStore>>>;

export interface StorePublicContextValue {
  publicStore: PublicStoreSnapshot;
  publicBasePath: string;
  publicStoreQueryKey: readonly unknown[];
  tableNo?: string;
}

export function useStorePublicContext() {
  return useOutletContext<StorePublicContextValue>();
}

export function StorePublicLayout() {
  const params = useParams<{ storeSlug?: string; storeId?: string }>();
  const [searchParams] = useSearchParams();
  const tableNo = searchParams.get('table') || undefined;
  const storeSlug = params.storeSlug || '';
  const storeId = params.storeId || '';
  const isStoreIdRoute = Boolean(storeId);
  const publicStoreQueryKey = isStoreIdRoute ? queryKeys.publicStoreById(storeId) : queryKeys.publicStoreBySlug(storeSlug);

  const publicStoreQuery = useQuery({
    queryKey: publicStoreQueryKey,
    queryFn: () => (isStoreIdRoute ? getPublicStoreById(storeId) : getPublicStore(storeSlug)),
    enabled: Boolean(storeSlug || storeId),
  });

  const publicBasePath =
    isStoreIdRoute && publicStoreQuery.data ? buildStoreIdPath(publicStoreQuery.data.store.id) : buildStorePath(storeSlug);

  const pageTitle = publicStoreQuery.data ? `${publicStoreQuery.data.store.name} Store` : 'Public Store';
  const pageDescription = publicStoreQuery.data
    ? `${publicStoreQuery.data.store.name} public storefront with menu, notices, survey CTA, and inquiry flow.`
    : 'MyBizLab public store page.';

  usePageMeta(pageTitle, pageDescription);

  if (publicStoreQuery.isLoading) {
    return (
      <div className="page-shell py-20">
        <div className="section-card p-10 text-center text-sm text-slate-500">Loading store information...</div>
      </div>
    );
  }

  if (!publicStoreQuery.data) {
    return (
      <div className="page-shell py-20">
        <EmptyState
          action={
            <Link className="btn-primary" to="/">
              Go Home
            </Link>
          }
          description="The store does not exist or is not available yet."
          title="Store not found"
        />
      </div>
    );
  }

  const config = getStoreBrandConfig(publicStoreQuery.data.store);
  const consultationLink = `tel:${config.phone.replace(/[^0-9+]/g, '')}`;
  const inquiryLink = `mailto:${config.email}?subject=${encodeURIComponent(`[${publicStoreQuery.data.store.name}] Inquiry`)}`;
  const reservationLink = `mailto:${config.email}?subject=${encodeURIComponent(`[${publicStoreQuery.data.store.name}] Reservation`)}`;

  return (
    <div className="flex min-h-screen flex-col bg-[#fffaf3]">
      <header className="border-b border-slate-200/70 bg-white/85 backdrop-blur">
        <div className="page-shell flex flex-col gap-4 py-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-orange-600">
                  {isStoreIdRoute ? publicStoreQuery.data.store.id : publicStoreQuery.data.store.slug}
                </p>
                {publicStoreQuery.data.store.public_status !== 'public' ? (
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">Preview</span>
                ) : null}
              </div>
              <h1 className="font-display text-3xl font-black text-slate-900">{publicStoreQuery.data.store.name}</h1>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">{publicStoreQuery.data.store.tagline}</p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {tableNo ? <span className="rounded-full bg-orange-100 px-4 py-2 text-sm font-bold text-orange-700">Table {tableNo}</span> : null}
              {publicStoreQuery.data.capabilities.consultationEnabled ? (
                <a className="btn-secondary" href={consultationLink}>
                  Call
                </a>
              ) : null}
              {publicStoreQuery.data.capabilities.inquiryEnabled ? (
                <a className="btn-secondary" href={inquiryLink}>
                  Inquiry
                </a>
              ) : null}
              {publicStoreQuery.data.capabilities.reservationEnabled ? (
                <a className="btn-secondary" href={reservationLink}>
                  Reserve
                </a>
              ) : null}
              {publicStoreQuery.data.capabilities.orderEntryEnabled ? (
                <NavLink className="btn-primary" to={`${publicBasePath}/order${tableNo ? `?table=${tableNo}` : ''}`}>
                  Order
                </NavLink>
              ) : null}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <NavLink className="btn-secondary" to={publicBasePath}>
              Home
            </NavLink>
            <NavLink className="btn-secondary" to={`${publicBasePath}/menu`}>
              Menu
            </NavLink>
            {publicStoreQuery.data.capabilities.orderEntryEnabled ? (
              <NavLink className="btn-secondary" to={`${publicBasePath}/order${tableNo ? `?table=${tableNo}` : ''}`}>
                Order
              </NavLink>
            ) : null}
          </div>
        </div>
      </header>

      <main className="page-shell flex-1 py-8">
        <Outlet
          context={{
            publicStore: publicStoreQuery.data,
            publicBasePath,
            publicStoreQueryKey,
            tableNo,
          }}
        />
      </main>

      <AppFooter />
    </div>
  );
}
