import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';

import { EmptyState } from '@/shared/components/EmptyState';
import { queryKeys } from '@/shared/lib/queryKeys';
import {
  getPublicPlatformAnnouncements,
  getPublicPlatformBoardPosts,
  getPublicPlatformPage,
} from '@/shared/lib/services/platformAdminContentService';
import { usePageMeta } from '@/shared/hooks/usePageMeta';

function formatDate(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString('ko-KR');
}

export function PlatformPublicUpdatesPage() {
  const announcementsQuery = useQuery({
    queryKey: queryKeys.publicPlatformAnnouncements,
    queryFn: getPublicPlatformAnnouncements,
  });
  const postsQuery = useQuery({
    queryKey: queryKeys.publicPlatformBoardPosts,
    queryFn: getPublicPlatformBoardPosts,
  });
  const announcements = announcementsQuery.data || [];
  const posts = postsQuery.data || [];

  return (
    <main className="page-shell py-14 sm:py-16">
      <section className="section-card p-6 sm:p-8">
        <p className="eyebrow">MyBiz 소식</p>
        <h1 className="mt-3 font-display text-4xl font-black text-slate-950">공지와 업데이트</h1>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">
          MyBiz 서비스 운영 공지, 기능 업데이트, 점주 운영 가이드를 확인할 수 있습니다.
        </p>
      </section>

      <section className="mt-8 grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="section-card p-6">
          <h2 className="font-display text-2xl font-black text-slate-950">공지</h2>
          <div className="mt-5 space-y-3">
            {announcements.map((notice) => (
              <article key={notice.id} className="rounded-3xl border border-slate-200 bg-white p-5">
                <div className="flex flex-wrap items-center gap-2 text-xs font-black text-slate-500">
                  <span>{notice.category || 'service'}</span>
                  {notice.is_pinned ? <span className="rounded-full bg-orange-50 px-2 py-1 text-orange-700">고정</span> : null}
                </div>
                <h3 className="mt-2 text-lg font-black text-slate-950">{notice.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{notice.summary || notice.body}</p>
                {notice.link_href ? (
                  <Link className="mt-4 inline-flex text-sm font-black text-orange-600" to={notice.link_href}>
                    {notice.link_label || '자세히 보기'}
                  </Link>
                ) : null}
              </article>
            ))}
            {!announcements.length ? (
              <EmptyState title="게시 중인 공지가 없습니다" description="새 공지가 등록되면 이곳에 표시됩니다." />
            ) : null}
          </div>
        </div>

        <div className="section-card p-6">
          <h2 className="font-display text-2xl font-black text-slate-950">업데이트 게시판</h2>
          <div className="mt-5 space-y-3">
            {posts.map((post) => (
              <Link key={post.id} className="block rounded-3xl border border-slate-200 bg-white p-5 transition hover:border-orange-300" to={`/updates/${post.slug}`}>
                <div className="flex flex-wrap items-center gap-2 text-xs font-black text-slate-500">
                  <span>{post.category || 'update'}</span>
                  {post.is_pinned ? <span className="rounded-full bg-orange-50 px-2 py-1 text-orange-700">고정</span> : null}
                  {formatDate(post.published_at) ? <span>{formatDate(post.published_at)}</span> : null}
                </div>
                <h3 className="mt-2 text-lg font-black text-slate-950">{post.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{post.excerpt}</p>
              </Link>
            ))}
            {!posts.length ? (
              <EmptyState title="게시 중인 업데이트가 없습니다" description="새 게시글이 등록되면 이곳에 표시됩니다." />
            ) : null}
          </div>
        </div>
      </section>
    </main>
  );
}

export function PlatformPublicBoardPostPage() {
  const { slug } = useParams();
  const postsQuery = useQuery({
    queryKey: queryKeys.publicPlatformBoardPosts,
    queryFn: getPublicPlatformBoardPosts,
  });
  const post = (postsQuery.data || []).find((item) => item.slug === slug);

  if (postsQuery.isLoading) {
    return (
      <main className="page-shell py-14">
        <p className="text-sm font-bold text-slate-500">게시글을 불러오는 중입니다.</p>
      </main>
    );
  }

  if (!post) {
    return (
      <main className="page-shell py-14">
        <EmptyState title="게시글을 찾을 수 없습니다" description="주소를 확인하거나 업데이트 목록으로 돌아가세요." />
        <Link className="btn-primary mt-4 inline-flex" to="/updates">업데이트 목록으로</Link>
      </main>
    );
  }

  return (
    <main className="page-shell py-14 sm:py-16">
      <article className="section-card mx-auto max-w-3xl p-6 sm:p-8">
        <p className="eyebrow">{post.category || 'MyBiz 업데이트'}</p>
        <h1 className="mt-3 font-display text-4xl font-black text-slate-950">{post.title}</h1>
        <p className="mt-3 text-sm font-bold text-slate-500">{formatDate(post.published_at)}</p>
        {post.cover_image_url ? (
          <img alt={post.title} className="mt-6 rounded-3xl border border-slate-200" src={post.cover_image_url} />
        ) : null}
        <div className="mt-6 whitespace-pre-wrap text-sm leading-7 text-slate-700">{post.body}</div>
      </article>
    </main>
  );
}

const pageEyebrows: Record<string, string> = {
  about: 'MyBiz 소개',
  contact: '도입 문의',
  faq: '자주 묻는 질문',
  features: '기능',
  trust: '신뢰와 보안',
};

export function PlatformPublicInfoPage({ slug }: { slug: string }) {
  const pageQuery = useQuery({
    queryKey: queryKeys.publicPlatformPage(slug),
    queryFn: () => getPublicPlatformPage(slug),
  });
  const data = pageQuery.data;
  const page = data?.page;

  usePageMeta(page?.seo_title || 'MyBiz | 고객 기억 기반 매출 AI SaaS', page?.seo_description || page?.description || '');

  if (pageQuery.isLoading || !page) {
    return (
      <main className="page-shell py-14">
        <p className="text-sm font-bold text-slate-500">페이지를 불러오는 중입니다.</p>
      </main>
    );
  }

  const cards = Array.isArray(page.payload.cards) ? page.payload.cards.map(String).filter(Boolean) : [];

  return (
    <main className="overflow-hidden">
      <section className="relative bg-slate-950 px-5 py-16 text-white sm:px-8 lg:px-10">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(251,146,60,0.22),transparent_32%),radial-gradient(circle_at_80%_30%,rgba(59,130,246,0.18),transparent_32%)]" />
        <div className="relative mx-auto max-w-6xl">
          <p className="text-[11px] font-black uppercase tracking-[0.22em] text-orange-300">{pageEyebrows[slug] || 'MyBiz'}</p>
          <h1 className="mt-4 max-w-4xl break-keep font-display text-4xl font-black leading-tight tracking-[-0.04em] sm:text-5xl">
            {page.title}
          </h1>
          <p className="mt-5 max-w-3xl break-keep text-base leading-8 text-slate-300">{page.description || page.body}</p>
          {page.cta_href ? (
            <Link className="btn-primary mt-8 inline-flex" to={page.cta_href}>
              {page.cta_label || '자세히 보기'}
            </Link>
          ) : null}
        </div>
      </section>

      <section className="page-shell py-12 sm:py-16">
        <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          <article className="section-card p-6 sm:p-8">
            <h2 className="font-display text-2xl font-black text-slate-950">핵심 안내</h2>
            <p className="mt-4 whitespace-pre-wrap break-keep text-sm leading-8 text-slate-700">{page.body}</p>
            {cards.length ? (
              <div className="mt-6 grid gap-3">
                {cards.map((card) => (
                  <div key={card} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700">
                    {card}
                  </div>
                ))}
              </div>
            ) : null}
          </article>

          <aside className="space-y-4">
            {(data?.trustSignals || []).slice(0, 3).map((signal) => (
              <article key={signal.signal_key} className="section-card p-5">
                <p className="text-sm font-black text-orange-600">{signal.title}</p>
                <p className="mt-2 break-keep text-sm leading-6 text-slate-600">{signal.body}</p>
              </article>
            ))}
          </aside>
        </div>

        {slug === 'faq' || (data?.faqItems || []).length ? (
          <section className="mt-10">
            <p className="eyebrow">FAQ</p>
            <h2 className="mt-3 font-display text-3xl font-black text-slate-950">자주 묻는 질문</h2>
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              {(data?.faqItems || []).map((item) => (
                <article key={item.question} className="section-card p-5">
                  <h3 className="break-keep text-base font-black text-slate-950">{item.question}</h3>
                  <p className="mt-3 break-keep text-sm leading-7 text-slate-600">{item.answer}</p>
                </article>
              ))}
            </div>
          </section>
        ) : null}
      </section>
    </main>
  );
}

export function PlatformFeaturesPage() {
  return <PlatformPublicInfoPage slug="features" />;
}

export function PlatformFaqPage() {
  return <PlatformPublicInfoPage slug="faq" />;
}

export function PlatformAboutPage() {
  return <PlatformPublicInfoPage slug="about" />;
}

export function PlatformContactPage() {
  return <PlatformPublicInfoPage slug="contact" />;
}

export function PlatformTrustPage() {
  return <PlatformPublicInfoPage slug="trust" />;
}
