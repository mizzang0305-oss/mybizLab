/**
 * platform-public/page.tsx
 * Dark-themed, motion-powered public info pages:
 * notices/updates, FAQ (accordion), trust, contact, features, cases.
 */
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { motion, AnimatePresence, useScroll, useTransform } from 'motion/react';
import { useQuery } from '@tanstack/react-query';

import { usePageMeta } from '@/shared/hooks/usePageMeta';
import { FALLBACK_PUBLIC_PAGES, FALLBACK_FAQ_ITEMS, FALLBACK_TRUST_SIGNALS } from '@/shared/lib/platformAdminConfig';
import { queryKeys } from '@/shared/lib/queryKeys';
import {
  getPublicPlatformAnnouncements,
  getPublicPlatformBoardPosts,
  getPublicPlatformPage,
} from '@/shared/lib/services/platformAdminContentService';

// ─── Shared easing ────────────────────────────────────────────────────────────
const EASE_EXPO = [0.16, 1, 0.3, 1] as const;
const EASE_CIRC = [0.22, 1, 0.36, 1] as const;

// ─── Shared reveal ────────────────────────────────────────────────────────────
function FadeUp({ children, delay = 0, className = '' }: { children: React.ReactNode; delay?: number; className?: string }) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-6%' }}
      transition={{ duration: 0.75, ease: EASE_CIRC, delay }}
    >
      {children}
    </motion.div>
  );
}

function LineUp({ children, delay = 0, className = '' }: { children: React.ReactNode; delay?: number; className?: string }) {
  return (
    <div className={className} style={{ overflow: 'hidden' }}>
      <motion.div
        initial={{ y: '108%' }}
        whileInView={{ y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.9, ease: EASE_EXPO, delay }}
      >
        {children}
      </motion.div>
    </div>
  );
}

// ─── Date formatter ───────────────────────────────────────────────────────────
function formatDate(value?: string | null) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('ko-KR');
}

// ─── Hardcoded fallback content ───────────────────────────────────────────────
const FALLBACK_ANNOUNCEMENTS_DATA = [
  {
    id: 'fa1',
    category: '서비스',
    is_pinned: true,
    title: 'MyBiz 정식 서비스 오픈 안내',
    summary: '공개 스토어, 문의·예약·웨이팅·QR 주문, 고객 기억, 운영 대시보드 전 기능이 정식 출시되었습니다. FREE 플랜으로 결제 없이 바로 시작하실 수 있습니다.',
    link_href: '/onboarding?plan=free',
    link_label: '무료로 시작하기',
    published_at: '2026-05-01',
  },
  {
    id: 'fa2',
    category: '기능',
    is_pinned: false,
    title: 'SNS 자동 관리 기능 베타 출시',
    summary: 'AI가 매장 데이터를 기반으로 Instagram·네이버 블로그에 자동으로 콘텐츠를 생성하고 예약 발행하는 기능이 PRO 플랜 이상에서 베타 제공됩니다.',
    link_href: '/features',
    link_label: '기능 살펴보기',
    published_at: '2026-04-20',
  },
  {
    id: 'fa3',
    category: '운영',
    is_pinned: false,
    title: '매장 브랜딩 테마 5종 추가',
    summary: '라이트, 따뜻함, 모던, 미니멀, 볼드 5가지 테마와 폰트 3종을 선택해 공개 스토어를 브랜드에 맞게 꾸밀 수 있습니다.',
    link_href: '/features',
    link_label: '브랜딩 기능 보기',
    published_at: '2026-04-10',
  },
];

const FALLBACK_UPDATES_DATA = [
  {
    id: 'fu1',
    slug: 'v1-3-customer-memory-boost',
    category: '업데이트',
    is_pinned: true,
    title: 'v1.3 — 고객 기억 강화 업데이트',
    excerpt: '방문 패턴 분석, 선호 메뉴 자동 태깅, 재방문 안내 액션 추천 기능이 추가되었습니다.',
    published_at: '2026-05-10',
  },
  {
    id: 'fu2',
    slug: 'v1-2-sns-auto-publish',
    category: '기능',
    is_pinned: false,
    title: 'v1.2 — SNS 자동 발행 & 브랜딩 테마',
    excerpt: 'AI 콘텐츠 자동 생성, Instagram·네이버 블로그 예약 발행, 5가지 스토어 테마가 추가되었습니다.',
    published_at: '2026-04-22',
  },
  {
    id: 'fu3',
    slug: 'v1-1-qr-order-improvements',
    category: '개선',
    is_pinned: false,
    title: 'v1.1 — QR 주문 흐름 개선 & AI 상담 응답 속도 향상',
    excerpt: '테이블 QR 주문의 결제 연동 안정성이 개선되었고, AI 상담 응답 시간이 평균 40% 단축되었습니다.',
    published_at: '2026-03-30',
  },
  {
    id: 'fu4',
    slug: 'v1-0-launch',
    category: '출시',
    is_pinned: false,
    title: 'v1.0 — MyBiz 정식 출시',
    excerpt: '공개 스토어, 문의·예약·웨이팅·QR 주문, 고객 기억 엔진, 운영 대시보드 전 기능이 정식 출시되었습니다.',
    published_at: '2026-03-01',
  },
];

const FULL_FAQ_ITEMS = [
  // 요금제
  {
    category: '요금제',
    question: 'FREE 플랜으로 어디까지 할 수 있나요?',
    answer: 'FREE 플랜은 공개 스토어 개설, 문의·예약·웨이팅·QR 주문 기능, 고객 기억 최대 50건까지 무료로 사용할 수 있습니다. 결제 정보 없이 바로 시작할 수 있습니다.',
  },
  {
    category: '요금제',
    question: 'PRO와 VIP의 차이는 무엇인가요?',
    answer: 'PRO는 고객 기억 무제한, SNS 자동 관리(Instagram·네이버 블로그), AI 상담 우선 처리가 포함됩니다. VIP는 PRO 기능에 더해 전담 온보딩 지원, Threads·카카오 연동, 멀티 매장 관리, 월별 운영 리포트가 추가됩니다.',
  },
  {
    category: '요금제',
    question: '요금제는 언제든지 변경할 수 있나요?',
    answer: '업그레이드는 즉시 반영됩니다. 다운그레이드는 현재 결제 주기가 끝나는 시점부터 적용되며, 그때까지 기존 플랜이 유지됩니다.',
  },
  {
    category: '요금제',
    question: '카드 결제 외에 다른 결제 방법이 있나요?',
    answer: '현재는 신용카드·체크카드 결제를 지원합니다. 카카오페이, 네이버페이 등 간편결제는 순차적으로 추가될 예정입니다. 기업 도입 문의는 support@mybiz.ai.kr로 연락 주세요.',
  },
  // 제품
  {
    category: '제품',
    question: '고객 기억이 정확히 무엇인가요?',
    answer: '고객이 공개 스토어에서 남긴 문의, 예약, 웨이팅, QR 주문 정보가 한 고객의 타임라인으로 자동 연결됩니다. 방문 횟수, 선호 메뉴, 자주 오는 시간대 등이 운영 대시보드에 쌓여 재방문 안내와 맞춤 운영 액션의 근거가 됩니다.',
  },
  {
    category: '제품',
    question: '공개 스토어 URL을 직접 정할 수 있나요?',
    answer: '네, 대시보드 → 매장 설정에서 슬러그(URL 마지막 부분)를 원하는 값으로 변경할 수 있습니다. 예: mybiz.kr/my-cafe 형태로 설정됩니다.',
  },
  {
    category: '제품',
    question: '예약과 웨이팅을 동시에 운영할 수 있나요?',
    answer: '가능합니다. 예약과 웨이팅은 각각 독립적으로 켜고 끌 수 있어, 운영 상황에 맞게 자유롭게 조합할 수 있습니다.',
  },
  {
    category: '제품',
    question: 'QR 코드는 어떻게 만드나요?',
    answer: '대시보드 → QR 주문 관리에서 테이블별 QR 코드가 자동 생성됩니다. SVG 형식으로 다운로드해 직접 인쇄하거나, 제공되는 QR 카드 템플릿을 사용할 수 있습니다.',
  },
  // 운영
  {
    category: '운영',
    question: '여러 매장을 하나의 계정으로 관리할 수 있나요?',
    answer: 'VIP 플랜에서 멀티 매장 관리가 가능합니다. 대시보드 상단의 매장 전환 메뉴에서 빠르게 이동할 수 있습니다. PRO 이하 플랜은 매장 1개가 기본입니다.',
  },
  {
    category: '운영',
    question: 'AI 상담은 언제 응답하나요?',
    answer: 'AI 상담은 24시간 자동 응답합니다. 고객이 예약이나 문의를 남기면 즉시 안내 메시지를 발송하고, 점주 확인이 필요한 경우 운영 대시보드에 알림이 도착합니다.',
  },
  {
    category: '운영',
    question: '고객이 예약을 취소하면 어떻게 되나요?',
    answer: '예약 취소 시 점주에게 실시간 알림이 발송되고, 운영 대시보드의 예약 현황이 자동으로 업데이트됩니다. 취소 사유가 있으면 함께 표시됩니다.',
  },
  {
    category: '운영',
    question: '데이터는 어디에 저장되나요?',
    answer: '고객 데이터는 AWS 서울 리전(ap-northeast-2) 기반의 Supabase에 암호화 저장됩니다. 매장 운영 데이터는 점주만 접근할 수 있고, 플랫폼 관리자 접근 내역은 별도로 기록됩니다.',
  },
];

// ─── Category badge ────────────────────────────────────────────────────────────
function CategoryBadge({ label, accent = '#ec5b13' }: { label: string; accent?: string }) {
  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[9px] font-black uppercase tracking-widest"
      style={{ background: `${accent}18`, color: accent, border: `1px solid ${accent}30` }}
    >
      {label}
    </span>
  );
}

const CATEGORY_ACCENT: Record<string, string> = {
  서비스: '#ec5b13', 기능: '#3b82f6', 운영: '#a855f7',
  업데이트: '#10b981', 개선: '#f59e0b', 출시: '#ec5b13',
  요금제: '#ec5b13', 제품: '#3b82f6', 결제: '#10b981', 기타: '#64748b',
};

// ═══════════════════════════════════════════════════════════════════════════════
// NOTICES / UPDATES PAGE
// ═══════════════════════════════════════════════════════════════════════════════
export function PlatformPublicUpdatesPage() {
  usePageMeta('공지·업데이트 | MyBiz', 'MyBiz 서비스 공지, 기능 업데이트, 운영 가이드를 확인하세요.');

  const announcementsQuery = useQuery({
    queryKey: queryKeys.publicPlatformAnnouncements,
    queryFn: getPublicPlatformAnnouncements,
  });
  const postsQuery = useQuery({
    queryKey: queryKeys.publicPlatformBoardPosts,
    queryFn: getPublicPlatformBoardPosts,
  });

  const announcements = announcementsQuery.data?.length ? announcementsQuery.data : FALLBACK_ANNOUNCEMENTS_DATA;
  const posts = postsQuery.data?.length ? postsQuery.data : FALLBACK_UPDATES_DATA;

  return (
    <main className="overflow-x-hidden bg-[#03040a] text-white">
      {/* Hero */}
      <section className="relative overflow-hidden px-6 pb-20 pt-24 sm:px-10 lg:px-16">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{ background: 'radial-gradient(ellipse 70% 50% at 20% 0%, rgba(236,91,19,0.1) 0%, transparent 60%)' }}
        />
        <div className="relative mx-auto max-w-[90rem]">
          <FadeUp delay={0.05}>
            <p className="mb-4 font-mono text-sm font-bold uppercase tracking-[0.35em] text-[#ec5b13]/70">
              공지 & 업데이트 / News
            </p>
          </FadeUp>
          <LineUp delay={0.1}>
            <h1
              className="break-keep font-display font-black text-white"
              style={{ fontSize: 'clamp(2.8rem, 6vw, 6rem)', lineHeight: 1.05, letterSpacing: '-0.05em' }}
            >
              MyBiz 소식
            </h1>
          </LineUp>
          <FadeUp delay={0.3} className="mt-5 max-w-xl">
            <p className="break-keep text-base leading-8 text-white/45">
              서비스 운영 공지, 기능 업데이트, 점주 운영 가이드를 확인할 수 있습니다.
            </p>
          </FadeUp>
        </div>
      </section>

      {/* Boards */}
      <section className="px-6 pb-32 sm:px-10 lg:px-16">
        <div className="mx-auto max-w-[90rem]">
          <div className="grid gap-8 lg:grid-cols-[0.95fr_1.05fr]">

            {/* Left: 공지사항 */}
            <div>
              <FadeUp delay={0.1}>
                <div className="mb-6 flex items-center justify-between">
                  <h2 className="font-display text-2xl font-black text-white">공지사항</h2>
                  <span className="rounded-full border border-white/[0.08] px-3 py-1 text-xs font-bold text-white/35">{announcements.length}건</span>
                </div>
              </FadeUp>
              <div className="space-y-3">
                {announcements.map((notice, i) => (
                  <FadeUp key={notice.id} delay={0.15 + i * 0.07}>
                    <article
                      className="group relative overflow-hidden rounded-3xl border border-white/[0.07] bg-[#060810] p-6 transition-colors hover:border-white/[0.14]"
                    >
                      {notice.is_pinned && (
                        <div
                          className="pointer-events-none absolute left-0 top-0 h-full w-[3px] rounded-l-3xl"
                          style={{ background: '#ec5b13' }}
                        />
                      )}
                      <div className="flex flex-wrap items-center gap-2">
                        <CategoryBadge
                          label={notice.category || '서비스'}
                          accent={CATEGORY_ACCENT[notice.category || '서비스'] || '#ec5b13'}
                        />
                        {notice.is_pinned && <CategoryBadge label="고정" accent="#ec5b13" />}
                        {(notice as any).published_at && (
                          <span className="text-[9px] text-white/25">{formatDate((notice as any).published_at)}</span>
                        )}
                      </div>
                      <h3 className="mt-3 break-keep text-base font-black text-white/90 transition-colors group-hover:text-white">
                        {notice.title}
                      </h3>
                      <p className="mt-2 break-keep text-sm leading-6 text-white/42">{notice.summary || (notice as any).body}</p>
                      {notice.link_href && (
                        <Link
                          className="mt-4 inline-flex items-center gap-1.5 text-sm font-black transition-colors"
                          style={{ color: '#ec5b13' }}
                          to={notice.link_href}
                        >
                          {notice.link_label || '자세히 보기'} →
                        </Link>
                      )}
                    </article>
                  </FadeUp>
                ))}
              </div>
            </div>

            {/* Right: 업데이트 게시판 */}
            <div>
              <FadeUp delay={0.12}>
                <div className="mb-6 flex items-center justify-between">
                  <h2 className="font-display text-2xl font-black text-white">업데이트 게시판</h2>
                  <span className="rounded-full border border-white/[0.08] px-3 py-1 text-xs font-bold text-white/35">{posts.length}건</span>
                </div>
              </FadeUp>
              <div className="space-y-3">
                {posts.map((post, i) => (
                  <FadeUp key={post.id} delay={0.18 + i * 0.07}>
                    <Link
                      className="group relative block overflow-hidden rounded-3xl border border-white/[0.07] bg-[#060810] p-6 transition-all hover:border-white/[0.14] hover:bg-[#080d18]"
                      to={`/updates/${post.slug}`}
                    >
                      {post.is_pinned && (
                        <div
                          className="pointer-events-none absolute left-0 top-0 h-full w-[3px] rounded-l-3xl"
                          style={{ background: '#3b82f6' }}
                        />
                      )}
                      <div className="flex flex-wrap items-center gap-2">
                        <CategoryBadge
                          label={post.category || '업데이트'}
                          accent={CATEGORY_ACCENT[post.category || '업데이트'] || '#3b82f6'}
                        />
                        {post.is_pinned && <CategoryBadge label="고정" accent="#3b82f6" />}
                        {formatDate(post.published_at) && (
                          <span className="text-[9px] text-white/25">{formatDate(post.published_at)}</span>
                        )}
                      </div>
                      <h3 className="mt-3 break-keep text-base font-black text-white/90 transition-colors group-hover:text-white">
                        {post.title}
                      </h3>
                      <p className="mt-2 break-keep text-sm leading-6 text-white/42">{post.excerpt}</p>
                      <div className="mt-3 flex items-center gap-1.5 text-xs font-bold text-white/25 transition-colors group-hover:text-white/45">
                        자세히 읽기 →
                      </div>
                    </Link>
                  </FadeUp>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// BOARD POST DETAIL
// ═══════════════════════════════════════════════════════════════════════════════
export function PlatformPublicBoardPostPage() {
  const { slug } = useParams();
  const postsQuery = useQuery({
    queryKey: queryKeys.publicPlatformBoardPosts,
    queryFn: getPublicPlatformBoardPosts,
  });

  const allPosts = postsQuery.data?.length ? postsQuery.data : FALLBACK_UPDATES_DATA;
  const post = allPosts.find((item) => item.slug === slug);

  if (postsQuery.isLoading) {
    return (
      <main className="min-h-screen bg-[#03040a] px-6 py-24 text-white sm:px-10">
        <div className="mx-auto max-w-3xl">
          <p className="text-sm font-bold text-white/40">불러오는 중...</p>
        </div>
      </main>
    );
  }

  if (!post) {
    return (
      <main className="min-h-screen bg-[#03040a] px-6 py-24 text-white sm:px-10">
        <div className="mx-auto max-w-3xl">
          <p className="text-sm font-bold text-white/40">게시글을 찾을 수 없습니다.</p>
          <Link className="mt-6 inline-flex rounded-full border border-white/10 bg-white/[0.05] px-6 py-3 text-sm font-bold text-white/70 transition hover:text-white" to="/updates">
            업데이트 목록으로 →
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="overflow-x-hidden bg-[#03040a] text-white">
      <section className="relative overflow-hidden px-6 pb-16 pt-24 sm:px-10 lg:px-16">
        <div aria-hidden className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(ellipse 60% 40% at 20% 0%, rgba(59,130,246,0.08) 0%, transparent 60%)' }} />
        <div className="relative mx-auto max-w-3xl">
          <FadeUp delay={0.05}>
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <CategoryBadge label={post.category || '업데이트'} accent={CATEGORY_ACCENT[post.category || '업데이트'] || '#3b82f6'} />
              {formatDate(post.published_at) && <span className="text-xs text-white/30">{formatDate(post.published_at)}</span>}
            </div>
          </FadeUp>
          <LineUp delay={0.1}>
            <h1 className="break-keep font-display text-4xl font-black leading-tight tracking-[-0.04em] text-white sm:text-5xl">
              {post.title}
            </h1>
          </LineUp>
          <FadeUp delay={0.3} className="mt-5">
            <p className="break-keep text-lg leading-8 text-white/50">{post.excerpt}</p>
          </FadeUp>
        </div>
      </section>

      <section className="px-6 pb-32 sm:px-10">
        <div className="mx-auto max-w-3xl">
          {(post as any).cover_image_url && (
            <img alt={post.title} className="mb-8 rounded-3xl border border-white/[0.07] w-full object-cover" src={(post as any).cover_image_url} />
          )}
          <div className="rounded-3xl border border-white/[0.07] bg-[#060810] p-8">
            <div className="whitespace-pre-wrap break-keep text-sm leading-8 text-white/65">
              {(post as any).body || post.excerpt}
            </div>
          </div>
          <div className="mt-8">
            <Link className="inline-flex rounded-full border border-white/10 bg-white/[0.05] px-6 py-3 text-sm font-bold text-white/60 transition hover:text-white" to="/updates">
              ← 업데이트 목록으로
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// FAQ PAGE
// ═══════════════════════════════════════════════════════════════════════════════
function FaqAccordionItem({ question, answer, index }: { question: string; answer: string; index: number }) {
  const [open, setOpen] = useState(false);
  return (
    <FadeUp delay={0.05 + index * 0.04}>
      <button
        type="button"
        className="group w-full overflow-hidden rounded-2xl border border-white/[0.07] bg-[#060810] text-left transition-colors hover:border-white/[0.14]"
        onClick={() => setOpen((v) => !v)}
      >
        <div className="flex items-start justify-between gap-4 p-6">
          <h3 className="break-keep text-[15px] font-black text-white/85 transition-colors group-hover:text-white">
            {question}
          </h3>
          <motion.span
            className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-white/[0.1] text-white/40"
            animate={{ rotate: open ? 45 : 0 }}
            transition={{ duration: 0.3, ease: EASE_CIRC }}
          >
            +
          </motion.span>
        </div>
        <AnimatePresence initial={false}>
          {open && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.38, ease: EASE_CIRC }}
              style={{ overflow: 'hidden' }}
            >
              <div className="border-t border-white/[0.06] px-6 pb-6 pt-4">
                <p className="break-keep text-sm leading-7 text-white/52">{answer}</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </button>
    </FadeUp>
  );
}

function FaqPageContent({ faqItems }: { faqItems: typeof FULL_FAQ_ITEMS }) {
  const allItems = faqItems.length ? faqItems : FULL_FAQ_ITEMS;
  const [activeCategory, setActiveCategory] = useState('전체');
  const categories = ['전체', ...Array.from(new Set(allItems.map((f) => f.category)))];
  const filtered = activeCategory === '전체' ? allItems : allItems.filter((f) => f.category === activeCategory);

  return (
    <main className="overflow-x-hidden bg-[#03040a] text-white">
      {/* Hero */}
      <section className="relative overflow-hidden px-6 pb-20 pt-24 sm:px-10 lg:px-16">
        <div aria-hidden className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(ellipse 60% 50% at 80% 0%, rgba(168,85,247,0.1) 0%, transparent 60%)' }} />
        <div className="relative mx-auto max-w-[90rem]">
          <FadeUp delay={0.05}>
            <p className="mb-4 font-mono text-sm font-bold uppercase tracking-[0.35em] text-[#ec5b13]/70">자주 묻는 질문 / FAQ</p>
          </FadeUp>
          <LineUp delay={0.1}>
            <h1 className="break-keep font-display font-black text-white" style={{ fontSize: 'clamp(2.8rem, 6vw, 6rem)', lineHeight: 1.05, letterSpacing: '-0.05em' }}>
              자주 묻는 질문
            </h1>
          </LineUp>
          <FadeUp delay={0.3} className="mt-5 max-w-lg">
            <p className="break-keep text-base leading-8 text-white/45">
              처음 도입하는 사장님도 빠르게 판단할 수 있도록 핵심 질문만 모았습니다.
            </p>
          </FadeUp>
          <FadeUp delay={0.42} className="mt-8 flex flex-wrap gap-2">
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setActiveCategory(cat)}
                className="rounded-full px-4 py-2 text-xs font-bold transition-all"
                style={{
                  background: activeCategory === cat ? '#ec5b13' : 'rgba(255,255,255,0.06)',
                  color: activeCategory === cat ? 'white' : 'rgba(255,255,255,0.5)',
                  border: activeCategory === cat ? '1px solid #ec5b13' : '1px solid rgba(255,255,255,0.08)',
                }}
              >
                {cat}
              </button>
            ))}
          </FadeUp>
        </div>
      </section>

      {/* FAQ list */}
      <section className="px-6 pb-32 sm:px-10 lg:px-16">
        <div className="mx-auto max-w-[90rem]">
          <div className="grid gap-3 lg:grid-cols-2">
            {filtered.map((item, i) => (
              <FaqAccordionItem key={item.question} question={item.question} answer={item.answer} index={i} />
            ))}
          </div>

          {/* Bottom CTA */}
          <FadeUp delay={0.2} className="mt-16 overflow-hidden rounded-3xl border border-white/[0.07] bg-[#060810] p-8 text-center sm:p-12">
            <p className="font-mono text-sm font-bold uppercase tracking-[0.3em] text-[#ec5b13]/70">더 궁금한 게 있으신가요?</p>
            <h2 className="mt-4 font-display text-3xl font-black text-white tracking-tight">직접 문의해 주세요</h2>
            <p className="mt-3 text-sm leading-7 text-white/45">실제 매장 운영 흐름에 맞춰 친절하게 안내해 드립니다.</p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
              <Link className="rounded-full bg-[#ec5b13] px-8 py-3.5 text-sm font-black text-white shadow-[0_0_40px_rgba(236,91,19,0.4)] transition hover:bg-[#d94f0b]" to="/contact">
                문의하기
              </Link>
              <Link className="rounded-full border border-white/10 bg-white/[0.05] px-8 py-3.5 text-sm font-bold text-white/70 transition hover:text-white" to="/onboarding?plan=free">
                무료로 시작하기
              </Link>
            </div>
          </FadeUp>
        </div>
      </section>
    </main>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TRUST PAGE
// ═══════════════════════════════════════════════════════════════════════════════
const TRUST_ITEMS = [
  {
    icon: '🔒',
    accent: '#3b82f6',
    title: '데이터 암호화 저장',
    body: '모든 고객 데이터는 AES-256 암호화를 적용해 AWS 서울 리전에 저장됩니다. 전송 구간은 TLS 1.3으로 보호됩니다.',
  },
  {
    icon: '⚡',
    accent: '#ec5b13',
    title: '서버 기준 결제 처리',
    body: '결제 금액과 상품 정보는 화면 표시값이 아닌 서버의 검증된 데이터를 기준으로 처리합니다. 클라이언트 변조에 영향받지 않습니다.',
  },
  {
    icon: '🛡️',
    accent: '#10b981',
    title: '공개 콘텐츠 품질 관리',
    body: '고객에게 표시되는 공개 페이지는 승인된 콘텐츠만 게시됩니다. 내부 운영 정보와 공개 정보가 명확히 분리됩니다.',
  },
  {
    icon: '🔑',
    accent: '#a855f7',
    title: '권한 분리 구조',
    body: '점주 계정·플랫폼 관리자·공개 고객 접점은 서로 다른 인증 체계로 완전히 분리됩니다. 권한 없는 접근은 서버에서 차단됩니다.',
  },
  {
    icon: '📋',
    accent: '#f59e0b',
    title: '접근 내역 기록',
    body: '플랫폼 관리자의 데이터 접근 내역은 별도로 기록·보관됩니다. 점주는 자신의 매장 데이터에 대한 접근 이력을 요청할 수 있습니다.',
  },
  {
    icon: '🤝',
    accent: '#06b6d4',
    title: '개인정보처리방침 준수',
    body: '개인정보보호법 및 정보통신망법에 따라 개인정보를 수집·처리합니다. 수집 최소화 원칙을 적용하며, 보유 기간을 명시합니다.',
  },
];

function TrustPageContent() {
  return (
    <main className="overflow-x-hidden bg-[#03040a] text-white">
      {/* Hero */}
      <section className="relative overflow-hidden px-6 pb-20 pt-24 sm:px-10 lg:px-16">
        <div aria-hidden className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(ellipse 60% 50% at 10% 0%, rgba(59,130,246,0.1) 0%, transparent 60%)' }} />
        <div className="relative mx-auto max-w-[90rem]">
          <FadeUp delay={0.05}>
            <p className="mb-4 font-mono text-sm font-bold uppercase tracking-[0.35em] text-[#3b82f6]/80">신뢰센터 / Trust</p>
          </FadeUp>
          <LineUp delay={0.1}>
            <h1 className="break-keep font-display font-black text-white" style={{ fontSize: 'clamp(2.4rem, 5.5vw, 5.5rem)', lineHeight: 1.05, letterSpacing: '-0.05em' }}>
              고객 기억을 안전하게<br />운영하기 위한 기준
            </h1>
          </LineUp>
          <FadeUp delay={0.3} className="mt-5 max-w-xl">
            <p className="break-keep text-base leading-8 text-white/45">
              MyBiz는 고객 데이터를 신뢰 있게 관리하고, 매장이 안심하고 운영할 수 있도록 돕습니다.
            </p>
          </FadeUp>
        </div>
      </section>

      {/* Trust signal grid */}
      <section className="px-6 pb-24 sm:px-10 lg:px-16">
        <div className="mx-auto max-w-[90rem]">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {TRUST_ITEMS.map((item, i) => (
              <FadeUp key={item.title} delay={0.08 + i * 0.07}>
                <article
                  className="group relative overflow-hidden rounded-3xl border border-white/[0.07] bg-[#060810] p-7 transition-colors hover:border-white/[0.15]"
                >
                  <div
                    className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl text-xl"
                    style={{ background: `${item.accent}18`, border: `1px solid ${item.accent}30` }}
                  >
                    {item.icon}
                  </div>
                  <h3 className="break-keep text-lg font-black text-white/90 transition-colors group-hover:text-white">
                    {item.title}
                  </h3>
                  <p className="mt-3 break-keep text-sm leading-7 text-white/42">{item.body}</p>
                  <div
                    className="pointer-events-none absolute bottom-0 left-0 h-[2px] w-0 rounded-full transition-all duration-500 group-hover:w-full"
                    style={{ background: item.accent }}
                  />
                </article>
              </FadeUp>
            ))}
          </div>

          {/* Data handling transparency */}
          <FadeUp delay={0.2} className="mt-10">
            <div className="overflow-hidden rounded-3xl border border-white/[0.07] bg-[#060810]">
              <div className="border-b border-white/[0.07] px-8 py-6">
                <p className="font-mono text-sm font-bold uppercase tracking-[0.3em] text-white/30">데이터 처리 방식</p>
                <h2 className="mt-3 font-display text-2xl font-black text-white">투명한 데이터 관리</h2>
              </div>
              <div className="grid gap-px bg-white/[0.04] sm:grid-cols-3">
                {[
                  { label: '저장 위치', value: 'AWS 서울 리전', note: 'ap-northeast-2' },
                  { label: '암호화', value: 'AES-256 + TLS 1.3', note: '전송·저장 전 구간' },
                  { label: '보유 기간', value: '탈퇴 후 30일', note: '법령에 따른 예외 존재' },
                ].map((item) => (
                  <div key={item.label} className="bg-[#060810] px-7 py-6">
                    <p className="text-xs font-bold uppercase tracking-widest text-white/30">{item.label}</p>
                    <p className="mt-2 text-lg font-black text-white/85">{item.value}</p>
                    <p className="mt-1 text-xs text-white/30">{item.note}</p>
                  </div>
                ))}
              </div>
            </div>
          </FadeUp>

          {/* Policy links */}
          <FadeUp delay={0.25} className="mt-8 flex flex-wrap gap-3">
            {[['개인정보처리방침', '/privacy'], ['이용약관', '/terms'], ['환불정책', '/refund']].map(([label, href]) => (
              <Link
                key={href}
                className="rounded-full border border-white/[0.09] bg-white/[0.04] px-5 py-2.5 text-sm font-bold text-white/55 transition hover:border-white/[0.18] hover:text-white"
                to={href}
              >
                {label} →
              </Link>
            ))}
          </FadeUp>
        </div>
      </section>
    </main>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONTACT PAGE
// ═══════════════════════════════════════════════════════════════════════════════
function ContactPageContent() {
  return (
    <main className="overflow-x-hidden bg-[#03040a] text-white">
      {/* Hero */}
      <section className="relative overflow-hidden px-6 pb-20 pt-24 sm:px-10 lg:px-16">
        <div aria-hidden className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(ellipse 55% 45% at 90% 10%, rgba(16,185,129,0.08) 0%, transparent 55%)' }} />
        <div className="relative mx-auto max-w-[90rem]">
          <FadeUp delay={0.05}>
            <p className="mb-4 font-mono text-sm font-bold uppercase tracking-[0.35em] text-[#ec5b13]/70">문의하기 / Contact</p>
          </FadeUp>
          <LineUp delay={0.1}>
            <h1 className="break-keep font-display font-black text-white" style={{ fontSize: 'clamp(2.8rem, 6vw, 6rem)', lineHeight: 1.05, letterSpacing: '-0.05em' }}>
              도입과 운영을<br />함께 확인해 드립니다
            </h1>
          </LineUp>
          <FadeUp delay={0.3} className="mt-5 max-w-xl">
            <p className="break-keep text-base leading-8 text-white/45">
              실제 매장 운영 흐름에 맞춰 도입 방법과 요금제를 안내해 드립니다.
            </p>
          </FadeUp>
        </div>
      </section>

      <section className="px-6 pb-32 sm:px-10 lg:px-16">
        <div className="mx-auto max-w-[90rem]">
          <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">

            {/* Left: contact channels */}
            <div className="space-y-4">
              <FadeUp delay={0.08}>
                <p className="mb-6 font-mono text-sm font-bold uppercase tracking-[0.3em] text-white/30">지원 채널</p>
              </FadeUp>
              {[
                {
                  icon: '✉️',
                  accent: '#ec5b13',
                  title: '이메일 문의',
                  value: 'support@mybiz.ai.kr',
                  note: '영업일 기준 24시간 이내 응답',
                  href: 'mailto:support@mybiz.ai.kr',
                  cta: '이메일 보내기',
                },
                {
                  icon: '💬',
                  accent: '#3b82f6',
                  title: 'AI 상담 체험',
                  value: '데모 대시보드',
                  note: '실제 AI 상담 흐름을 바로 체험할 수 있습니다',
                  href: '/demo/dashboard',
                  cta: '데모 대시보드 보기',
                },
                {
                  icon: '📋',
                  accent: '#10b981',
                  title: '도입 가이드',
                  value: 'FAQ & 업데이트',
                  note: '자주 묻는 질문과 최신 업데이트를 먼저 확인해 보세요',
                  href: '/faq',
                  cta: 'FAQ 바로가기',
                },
              ].map((ch, i) => (
                <FadeUp key={ch.title} delay={0.12 + i * 0.08}>
                  <div className="group overflow-hidden rounded-3xl border border-white/[0.07] bg-[#060810] p-7 transition-colors hover:border-white/[0.14]">
                    <div className="flex items-start gap-4">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-xl" style={{ background: `${ch.accent}18`, border: `1px solid ${ch.accent}30` }}>
                        {ch.icon}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold uppercase tracking-widest text-white/30">{ch.title}</p>
                        <p className="mt-1 text-lg font-black text-white/90">{ch.value}</p>
                        <p className="mt-1 text-sm text-white/38">{ch.note}</p>
                        <Link
                          className="mt-4 inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-bold text-white transition-all"
                          style={{ background: `${ch.accent}20`, border: `1px solid ${ch.accent}30`, color: ch.accent }}
                          to={ch.href}
                        >
                          {ch.cta} →
                        </Link>
                      </div>
                    </div>
                  </div>
                </FadeUp>
              ))}
            </div>

            {/* Right: quick FAQ + start CTA */}
            <div className="space-y-4">
              <FadeUp delay={0.1}>
                <p className="mb-6 font-mono text-sm font-bold uppercase tracking-[0.3em] text-white/30">빠른 안내</p>
              </FadeUp>
              <FadeUp delay={0.14}>
                <div className="overflow-hidden rounded-3xl border border-white/[0.07] bg-[#060810] p-7">
                  <h2 className="font-display text-xl font-black text-white">운영 시간</h2>
                  <div className="mt-5 space-y-3">
                    {[
                      ['AI 자동 응답', '24시간 / 365일'],
                      ['이메일 지원', '평일 09:00 – 18:00'],
                      ['공지 업데이트', '수시 공개'],
                    ].map(([label, val]) => (
                      <div key={label} className="flex items-center justify-between border-b border-white/[0.05] pb-3 last:border-0 last:pb-0">
                        <span className="text-sm text-white/45">{label}</span>
                        <span className="text-sm font-bold text-white/80">{val}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </FadeUp>

              <FadeUp delay={0.22}>
                <div className="overflow-hidden rounded-3xl border border-[#ec5b13]/25 bg-[#ec5b13]/[0.06] p-7 text-center">
                  <p className="font-mono text-sm font-bold uppercase tracking-[0.3em] text-[#ec5b13]/70">바로 시작하기</p>
                  <h2 className="mt-3 font-display text-2xl font-black text-white">무료로 먼저 써보세요</h2>
                  <p className="mt-3 text-sm leading-6 text-white/45">결제 없이 공개 스토어와 고객 기억 흐름을 바로 시작할 수 있습니다.</p>
                  <Link
                    className="mt-6 inline-flex rounded-full bg-[#ec5b13] px-8 py-3.5 text-sm font-black text-white shadow-[0_0_36px_rgba(236,91,19,0.4)] transition hover:bg-[#d94f0b]"
                    to="/onboarding?plan=free"
                  >
                    무료로 시작하기
                  </Link>
                </div>
              </FadeUp>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// FEATURES PAGE
// ═══════════════════════════════════════════════════════════════════════════════
const FEATURE_BLOCKS = [
  {
    accent: '#ec5b13',
    icon: '🏪',
    title: '공개 스토어',
    desc: '고객이 메뉴를 보고 문의, 예약, 웨이팅, QR 주문을 시작하는 브랜드 공개 페이지입니다. URL 슬러그, 테마, 폰트를 직접 설정할 수 있습니다.',
    tags: ['URL 커스텀', '5가지 테마', '3가지 폰트', '모바일 최적화'],
  },
  {
    accent: '#3b82f6',
    icon: '📊',
    title: '운영 대시보드',
    desc: '오늘의 예약, 웨이팅, 주문, 문의를 한 화면에서 확인하고 즉시 처리할 수 있습니다. 실시간 알림과 고객 응대 히스토리가 포함됩니다.',
    tags: ['실시간 알림', '고객 응대', '일·주·월 뷰', '모바일 대응'],
  },
  {
    accent: '#a855f7',
    icon: '🧠',
    title: '고객 기억 엔진',
    desc: '고객의 방문 횟수, 선호 메뉴, 최근 주문, 문의 이력이 한 타임라인으로 쌓입니다. 재방문 안내와 맞춤 운영 액션의 근거가 됩니다.',
    tags: ['방문 패턴', '선호 태그', '타임라인', '재방문 안내'],
  },
  {
    accent: '#10b981',
    icon: '📱',
    title: 'SNS 자동 관리',
    desc: 'AI가 매장 데이터를 읽고 Instagram, 네이버 블로그, Threads에 자동으로 콘텐츠를 생성·발행합니다. PRO 플랜 이상에서 이용 가능합니다.',
    tags: ['Instagram', '네이버 블로그', 'Threads', 'AI 자동 생성'],
  },
  {
    accent: '#f59e0b',
    icon: '🤖',
    title: 'AI 상담',
    desc: '고객 문의를 24시간 AI가 자동 응대합니다. 예약·웨이팅·메뉴 안내를 처리하고, 대화 내용이 고객 기억으로 자동 연결됩니다.',
    tags: ['24시간 응대', '예약 처리', '고객 기억 연결', '알림 발송'],
  },
  {
    accent: '#06b6d4',
    icon: '📦',
    title: 'QR 주문',
    desc: '테이블별 QR 코드로 고객이 직접 메뉴를 보고 주문할 수 있습니다. 주문이 들어오면 대시보드에 즉시 알림이 도착합니다.',
    tags: ['테이블 QR', '실시간 알림', 'SVG 다운로드', '결제 연동'],
  },
];

function FeaturesPageContent() {
  return (
    <main className="overflow-x-hidden bg-[#03040a] text-white">
      <section className="relative overflow-hidden px-6 pb-20 pt-24 sm:px-10 lg:px-16">
        <div aria-hidden className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(ellipse 60% 50% at 50% 0%, rgba(236,91,19,0.1) 0%, transparent 60%)' }} />
        <div className="relative mx-auto max-w-[90rem]">
          <FadeUp delay={0.05}><p className="mb-4 font-mono text-sm font-bold uppercase tracking-[0.35em] text-[#ec5b13]/70">핵심 기능 / Features</p></FadeUp>
          <LineUp delay={0.1}>
            <h1 className="break-keep font-display font-black text-white" style={{ fontSize: 'clamp(2.8rem, 6vw, 6rem)', lineHeight: 1.05, letterSpacing: '-0.05em' }}>
              고객 기억으로 이어지는 매장 운영 기능
            </h1>
          </LineUp>
          <FadeUp delay={0.3} className="mt-5 max-w-xl">
            <p className="break-keep text-base leading-8 text-white/45">흩어진 고객 행동을 기억하고, 사장님이 다음 액션을 빠르게 결정할 수 있게 만드는 운영 플랫폼입니다.</p>
          </FadeUp>
          <FadeUp delay={0.42} className="mt-8 flex flex-wrap gap-3">
            <Link className="rounded-full bg-[#ec5b13] px-7 py-3 text-sm font-black text-white shadow-[0_0_36px_rgba(236,91,19,0.4)] transition hover:bg-[#d94f0b]" to="/onboarding?plan=free">무료로 시작하기</Link>
            <Link className="rounded-full border border-white/10 bg-white/[0.05] px-7 py-3 text-sm font-bold text-white/70 transition hover:text-white" to="/demo/dashboard">데모 보기</Link>
          </FadeUp>
        </div>
      </section>

      <section className="px-6 pb-32 sm:px-10 lg:px-16">
        <div className="mx-auto max-w-[90rem]">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURE_BLOCKS.map((feat, i) => (
              <FadeUp key={feat.title} delay={0.06 + i * 0.06}>
                <article className="group relative overflow-hidden rounded-3xl border border-white/[0.07] bg-[#060810] p-7 transition-colors hover:border-white/[0.15]">
                  <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl text-xl" style={{ background: `${feat.accent}16`, border: `1px solid ${feat.accent}28` }}>
                    {feat.icon}
                  </div>
                  <h2 className="font-display text-xl font-black text-white/90 transition-colors group-hover:text-white">{feat.title}</h2>
                  <p className="mt-3 break-keep text-sm leading-7 text-white/42">{feat.desc}</p>
                  <div className="mt-5 flex flex-wrap gap-1.5">
                    {feat.tags.map((tag) => (
                      <span key={tag} className="rounded-full px-2.5 py-1 text-[9px] font-bold" style={{ background: `${feat.accent}12`, color: feat.accent }}>
                        {tag}
                      </span>
                    ))}
                  </div>
                  <div className="pointer-events-none absolute bottom-0 left-0 h-[2px] w-0 rounded-full transition-all duration-500 group-hover:w-full" style={{ background: feat.accent }} />
                </article>
              </FadeUp>
            ))}
          </div>

          {/* Pricing CTA */}
          <FadeUp delay={0.2} className="mt-12 grid gap-6 lg:grid-cols-3">
            {[
              { plan: 'FREE', accent: '#64748b', price: '₩0', desc: '공개 스토어 + 고객 기억 50건', href: '/onboarding?plan=free', cta: '무료로 시작' },
              { plan: 'PRO', accent: '#ec5b13', price: '월정액', desc: '고객 기억 무제한 + SNS 자동 관리', href: '/pricing', cta: '요금제 보기' },
              { plan: 'VIP', accent: '#a855f7', price: '월정액', desc: '멀티 매장 + 전담 지원 + 월별 리포트', href: '/pricing', cta: '요금제 보기' },
            ].map((p, i) => (
              <FadeUp key={p.plan} delay={0.1 + i * 0.08}>
                <div className="overflow-hidden rounded-3xl border border-white/[0.07] bg-[#060810] p-7">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-sm font-black" style={{ color: p.accent }}>{p.plan}</span>
                    <span className="text-lg font-black text-white">{p.price}</span>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-white/45">{p.desc}</p>
                  <Link className="mt-5 inline-flex rounded-full px-5 py-2.5 text-xs font-black text-white transition" style={{ background: `${p.accent}22`, border: `1px solid ${p.accent}35`, color: p.accent }} to={p.href}>
                    {p.cta} →
                  </Link>
                </div>
              </FadeUp>
            ))}
          </FadeUp>
        </div>
      </section>
    </main>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// GENERIC INFO PAGE (cases, about — fallback for unspecialized slugs)
// ═══════════════════════════════════════════════════════════════════════════════
export function PlatformPublicInfoPage({ slug }: { slug: string }) {
  const pageQuery = useQuery({
    queryKey: queryKeys.publicPlatformPage(slug),
    queryFn: () => getPublicPlatformPage(slug),
  });
  const fallbackPage = FALLBACK_PUBLIC_PAGES.find((p) => p.slug === slug) || FALLBACK_PUBLIC_PAGES[0];
  const data = pageQuery.data || { faqItems: [], page: fallbackPage, trustSignals: [] };
  const faqItems = (data.faqItems || []).map((f) => ({ category: f.category || '기타', question: f.question, answer: f.answer }));

  usePageMeta(data.page?.seo_title || 'MyBiz', data.page?.seo_description || '');

  // Route to specialized page components
  if (slug === 'faq') return <FaqPageContent faqItems={faqItems.length ? faqItems : FULL_FAQ_ITEMS} />;
  if (slug === 'trust') return <TrustPageContent />;
  if (slug === 'contact') return <ContactPageContent />;
  if (slug === 'features') return <FeaturesPageContent />;

  // Generic dark page for cases, about, etc.
  const page = data.page;
  const cards = Array.isArray(page?.payload?.cards) ? page.payload.cards.map(String).filter(Boolean) : [];

  return (
    <main className="overflow-x-hidden bg-[#03040a] text-white">
      <section className="relative overflow-hidden px-6 pb-20 pt-24 sm:px-10 lg:px-16">
        <div aria-hidden className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(ellipse 55% 40% at 20% 0%, rgba(236,91,19,0.09) 0%, transparent 55%)' }} />
        <div className="relative mx-auto max-w-[90rem]">
          <FadeUp delay={0.05}>
            <p className="mb-4 font-mono text-sm font-bold uppercase tracking-[0.35em] text-[#ec5b13]/70">MyBiz</p>
          </FadeUp>
          <LineUp delay={0.1}>
            <h1 className="break-keep font-display font-black text-white" style={{ fontSize: 'clamp(2.4rem, 5.5vw, 5.5rem)', lineHeight: 1.05, letterSpacing: '-0.05em' }}>
              {page?.title}
            </h1>
          </LineUp>
          <FadeUp delay={0.3} className="mt-5 max-w-xl">
            <p className="break-keep text-base leading-8 text-white/45">{page?.description || page?.body}</p>
          </FadeUp>
          {page?.cta_href && (
            <FadeUp delay={0.42} className="mt-8">
              <Link className="inline-flex rounded-full bg-[#ec5b13] px-8 py-3.5 text-sm font-black text-white transition hover:bg-[#d94f0b]" to={page.cta_href}>
                {page.cta_label || '자세히 보기'}
              </Link>
            </FadeUp>
          )}
        </div>
      </section>

      <section className="px-6 pb-32 sm:px-10 lg:px-16">
        <div className="mx-auto max-w-[90rem]">
          <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
            <FadeUp delay={0.1}>
              <div className="rounded-3xl border border-white/[0.07] bg-[#060810] p-8">
                <h2 className="font-display text-2xl font-black text-white">핵심 안내</h2>
                <p className="mt-5 whitespace-pre-wrap break-keep text-sm leading-8 text-white/55">{page?.body}</p>
                {cards.length > 0 && (
                  <div className="mt-6 space-y-3">
                    {cards.map((card) => (
                      <div key={card} className="rounded-2xl border border-white/[0.06] bg-white/[0.04] px-5 py-3 text-sm font-bold text-white/70">
                        {card}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </FadeUp>

            <div className="space-y-4">
              {(data.trustSignals || FALLBACK_TRUST_SIGNALS).slice(0, 3).map((signal, i) => (
                <FadeUp key={signal.signal_key} delay={0.12 + i * 0.07}>
                  <div className="rounded-3xl border border-white/[0.07] bg-[#060810] p-6">
                    <p className="text-sm font-black" style={{ color: '#ec5b13' }}>{signal.title}</p>
                    <p className="mt-2 break-keep text-sm leading-6 text-white/45">{signal.body}</p>
                  </div>
                </FadeUp>
              ))}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

// ─── Exports ──────────────────────────────────────────────────────────────────
export function PlatformFeaturesPage() { return <PlatformPublicInfoPage slug="features" />; }
export function PlatformFaqPage() { return <PlatformPublicInfoPage slug="faq" />; }
export function PlatformAboutPage() { return <PlatformPublicInfoPage slug="about" />; }
export function PlatformContactPage() { return <PlatformPublicInfoPage slug="contact" />; }
export function PlatformTrustPage() { return <PlatformPublicInfoPage slug="trust" />; }
export function PlatformCasesPage() { return <PlatformPublicInfoPage slug="cases" />; }
