import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';

import { useStorePublicContext } from '@/app/layouts/StorePublicLayout';
import { KakaoShareButton } from '@/shared/components/KakaoShareButton';
import { EmptyState } from '@/shared/components/EmptyState';
import { usePageMeta } from '@/shared/hooks/usePageMeta';
import { queryKeys } from '@/shared/lib/queryKeys';
import {
  buildBlogPostingJsonLd,
  canonicalUrl,
  safeImageUrl,
} from '@/shared/lib/seo';
import {
  getPublicStoreBlogPost,
  listPublicStoreBlogPosts,
} from '@/shared/lib/services/contentEngineService';

function formatDate(value?: string) {
  if (!value) {
    return '';
  }

  return new Date(value).toLocaleDateString('ko-KR');
}

export function StoreBlogListPage() {
  const { publicBasePath, publicStore } = useStorePublicContext();
  const storeId = publicStore.store.id;
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

  usePageMeta(`${publicStore.store.name} 블로그`, `${publicStore.store.name}의 매장 소식과 방문 경험 콘텐츠입니다.`, {
    canonicalUrl: canonicalUrl(`${publicBasePath}/blog`),
    ogImage: safeImageUrl(seoStore.logo_url),
    ogType: 'website',
  });

  const postsQuery = useQuery({
    queryKey: queryKeys.publicStoreBlog(storeId),
    queryFn: () => listPublicStoreBlogPosts(storeId),
  });
  const posts = postsQuery.data || [];

  return (
    <div className="space-y-6">
      <section className="rounded-[32px] border border-slate-200 bg-white p-6">
        <p className="eyebrow">Store Blog</p>
        <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="font-display text-3xl font-black text-slate-950">{publicStore.store.name} 블로그/소식</h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">
              매장 승인 후 공개된 소식과 고객 경험 기반 콘텐츠만 보여줍니다.
            </p>
          </div>
          <KakaoShareButton
            description={`${publicStore.store.name}의 공개 블로그 소식입니다.`}
            imageUrl={seoStore.logo_url}
            label="블로그 카카오톡 공유"
            sourceId={`${storeId}:blog`}
            sourceType="blog_list"
            title={`${publicStore.store.name} 블로그`}
            webUrl={canonicalUrl(`${publicBasePath}/blog`)}
          />
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        {posts.map((post) => (
          <Link
            className="overflow-hidden rounded-3xl border border-slate-200 bg-white transition hover:border-orange-300"
            key={post.post_id}
            to={`${publicBasePath}/blog/${post.slug}`}
          >
            {post.cover_image_url ? (
              <img alt={post.title} className="h-48 w-full object-cover" src={post.cover_image_url} />
            ) : null}
            <div className="p-5">
              <p className="text-xs font-black text-slate-500">{formatDate(post.published_at)}</p>
              <h2 className="mt-2 text-xl font-black text-slate-950">{post.title}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">{post.excerpt || post.body.slice(0, 120)}</p>
            </div>
          </Link>
        ))}
      </div>

      {!postsQuery.isLoading && !posts.length ? (
        <EmptyState title="아직 공개된 소식이 없습니다" description="매장이 블로그 글을 게시하면 이곳에 표시됩니다." />
      ) : null}
    </div>
  );
}

export function StoreBlogPostPage() {
  const { publicBasePath, publicStore } = useStorePublicContext();
  const { postSlug = '' } = useParams<{ postSlug: string }>();
  const storeId = publicStore.store.id;

  const postQuery = useQuery({
    queryKey: queryKeys.publicStoreBlogPost(storeId, postSlug),
    queryFn: () => getPublicStoreBlogPost(storeId, postSlug),
  });
  const post = postQuery.data;
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

  usePageMeta(
    post?.seo_title || post?.title || `${publicStore.store.name} 소식`,
    post?.seo_description || post?.excerpt || publicStore.store.description,
    {
      canonicalUrl: canonicalUrl(`${publicBasePath}/blog/${postSlug}`),
      jsonLd: post ? buildBlogPostingJsonLd({ post, store: seoStore }) : null,
      ogImage: safeImageUrl(post?.cover_image_url) || safeImageUrl(seoStore.logo_url),
      ogType: 'article',
    },
  );

  if (postQuery.isLoading) {
    return <p className="text-sm font-semibold text-slate-500">소식을 불러오는 중입니다.</p>;
  }

  if (!post) {
    return (
      <EmptyState
        action={<Link className="btn-primary" to={`${publicBasePath}/blog`}>블로그 목록</Link>}
        title="게시글을 찾을 수 없습니다"
        description="공개되지 않았거나 보관된 글입니다."
      />
    );
  }

  return (
    <article className="mx-auto max-w-3xl rounded-[32px] border border-slate-200 bg-white p-6 sm:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <Link className="text-sm font-black text-orange-700" to={`${publicBasePath}/blog`}>
          블로그 목록
        </Link>
        <KakaoShareButton
          description={post.seo_description || post.excerpt || publicStore.store.description}
          imageUrl={post.cover_image_url || seoStore.logo_url}
          label="카카오톡 공유"
          sourceId={post.post_id}
          sourceType="blog_post"
          title={post.title}
          webUrl={canonicalUrl(`${publicBasePath}/blog/${post.slug}`)}
        />
      </div>
      <p className="mt-6 text-xs font-black text-slate-500">{formatDate(post.published_at)}</p>
      <h1 className="mt-3 font-display text-4xl font-black text-slate-950">{post.title}</h1>
      {post.excerpt ? <p className="mt-3 text-base leading-7 text-slate-600">{post.excerpt}</p> : null}
      {post.cover_image_url ? <img alt={post.title} className="mt-6 rounded-3xl border border-slate-200" src={post.cover_image_url} /> : null}
      <div className="mt-6 whitespace-pre-wrap text-sm leading-8 text-slate-700">{post.body}</div>
    </article>
  );
}
