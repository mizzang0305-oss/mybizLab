import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';

import { EmptyState } from '@/shared/components/EmptyState';
import { queryKeys } from '@/shared/lib/queryKeys';
import {
  getPublicPlatformAnnouncements,
  getPublicPlatformBoardPosts,
} from '@/shared/lib/services/platformAdminContentService';

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
