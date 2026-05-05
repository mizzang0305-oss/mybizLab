import { FormEvent, useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';

import { Icons } from '@/shared/components/Icons';
import { usePageMeta } from '@/shared/hooks/usePageMeta';
import {
  DEMO_ADMIN_CREDENTIALS,
  createDemoAdminSession,
  hasDashboardAccess,
  isPlatformAdminPath,
  isDemoPasswordLoginEnabled,
  refreshAdminSession,
  sanitizeAdminNextPath,
  useAdminAccess,
} from '@/shared/lib/adminSession';
import { getPlatformAdminSession } from '@/shared/lib/services/platformAdminContentService';
import { LEGAL_LINKS } from '@/shared/lib/siteConfig';

type LoginMethod = 'google' | 'email' | 'demo';
type MessageTone = 'error' | 'info';

interface MessageState {
  tone: MessageTone;
  text: string;
}

function getMessageClassName(tone: MessageTone) {
  if (tone === 'error') {
    return 'rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700';
  }

  return 'rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700';
}

export function AdminLoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { session } = useAdminAccess();
  const [pendingMethod, setPendingMethod] = useState<LoginMethod | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState<MessageState | null>(null);
  const demoPasswordLoginEnabled = isDemoPasswordLoginEnabled();

  const nextPath = sanitizeAdminNextPath(searchParams.get('next'));
  const shouldValidatePlatformAdmin = isPlatformAdminPath(nextPath);

  usePageMeta(
    shouldValidatePlatformAdmin ? 'MyBiz 플랫폼 관리자 로그인' : 'MyBiz 점주 로그인',
    '점주는 매장 운영 화면으로, 플랫폼 관리자는 MyBiz 서비스 운영 콘솔로 안전하게 로그인합니다.',
  );

  if (hasDashboardAccess(session)) {
    return <Navigate replace to={nextPath} />;
  }

  async function signInWithDemoAccess(method: LoginMethod, options?: { email?: string; fullName?: string }) {
    try {
      setPendingMethod(method);
      setMessage(
        method === 'demo'
          ? { tone: 'info', text: '데모 운영 화면을 준비하고 있습니다.' }
          : method === 'google'
            ? { tone: 'info', text: 'Google 체험 로그인을 준비하고 있습니다.' }
            : { tone: 'info', text: '이메일 체험 로그인을 준비하고 있습니다.' },
      );

      const nextSession = await createDemoAdminSession({
        email: options?.email,
        fullName: options?.fullName,
      });

      if (!nextSession || !hasDashboardAccess(nextSession)) {
        throw new Error('데모 매장 접근 권한을 준비하지 못했습니다.');
      }

      navigate(nextPath, { replace: true });
    } catch {
      setMessage({
        tone: 'error',
        text: '로그인을 준비하지 못했습니다. 잠시 후 다시 시도해 주세요.',
      });
    } finally {
      setPendingMethod(null);
    }
  }

  function fillDemoCredentials() {
    setEmail(DEMO_ADMIN_CREDENTIALS.email);
    setPassword(DEMO_ADMIN_CREDENTIALS.password || '');
    setMessage(null);
  }

  async function handleEmailSignIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const normalizedEmail = email.trim().toLowerCase();
    const normalizedPassword = password.trim();

    if (!normalizedEmail || !normalizedPassword) {
      setMessage({ tone: 'error', text: '이메일과 비밀번호를 입력해 주세요.' });
      return;
    }

    setPendingMethod('email');
    setMessage({ tone: 'info', text: '로그인 중입니다...' });

    try {
      const { supabase } = await import('@/integrations/supabase/client');
      if (supabase) {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: normalizedEmail,
          password: normalizedPassword,
        });

        if (error) {
          if (demoPasswordLoginEnabled && normalizedEmail === DEMO_ADMIN_CREDENTIALS.email && normalizedPassword === DEMO_ADMIN_CREDENTIALS.password) {
            await signInWithDemoAccess('email', { email: normalizedEmail });
            return;
          }
          setMessage({ tone: 'error', text: '이메일 또는 비밀번호가 올바르지 않습니다.' });
          setPendingMethod(null);
          return;
        }

        if (data.user) {
          if (shouldValidatePlatformAdmin) {
            try {
              await getPlatformAdminSession();
              navigate(nextPath, { replace: true });
              return;
            } catch (platformAdminError) {
              await supabase.auth.signOut();
              setMessage({
                tone: 'error',
                text:
                  platformAdminError instanceof Error
                    ? platformAdminError.message
                    : 'MyBiz 플랫폼 관리자 권한을 확인하지 못했습니다.',
              });
              setPendingMethod(null);
              return;
            }
          }

          const nextSession = await refreshAdminSession();
          if (!hasDashboardAccess(nextSession)) {
            await supabase.auth.signOut();
            navigate('/onboarding', { replace: true });
            return;
          }

          navigate(nextPath, { replace: true });
          return;
        }
      }

      if (demoPasswordLoginEnabled && normalizedEmail === DEMO_ADMIN_CREDENTIALS.email && normalizedPassword === DEMO_ADMIN_CREDENTIALS.password) {
        await signInWithDemoAccess('email', { email: normalizedEmail });
        return;
      }

      setMessage({ tone: 'error', text: '이메일 또는 비밀번호가 올바르지 않습니다.' });
    } catch {
      setMessage({ tone: 'error', text: '로그인 중 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.' });
    } finally {
      setPendingMethod(null);
    }
  }

  return (
    <main className="page-shell py-12 sm:py-16">
      <div className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr]">
        <section className="relative overflow-hidden rounded-[36px] bg-slate-950 px-8 py-10 text-white shadow-[0_45px_90px_-40px_rgba(15,23,42,0.85)] sm:px-10 sm:py-12">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(236,91,19,0.55),_transparent_35%),radial-gradient(circle_at_bottom_right,_rgba(251,146,60,0.18),_transparent_25%)]" />
          <div className="relative space-y-6">
            <span className="inline-flex rounded-full border border-white/15 bg-white/10 px-4 py-2 text-xs font-bold uppercase tracking-[0.2em] text-orange-200">
              MyBiz Access
            </span>

            <div className="space-y-4">
              <h1 className="font-display text-4xl font-black tracking-tight sm:text-5xl">
                {shouldValidatePlatformAdmin ? '플랫폼 관리자 로그인' : '점주 로그인'}
              </h1>
              <p className="max-w-2xl text-base leading-7 text-slate-300 sm:text-lg">
                점주는 매장 운영과 고객 기억을 관리하고, 플랫폼 관리자는 홈페이지·가격표·공지·결제 테스트를 관리합니다.
                두 권한은 서버에서 분리해 확인합니다.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
                <p className="text-sm font-semibold text-orange-300">점주 운영</p>
                <p className="mt-2 text-sm leading-6 text-slate-300">
                  고객, 문의, 예약, 웨이팅, 주문을 한 매장의 고객 기억 흐름으로 확인합니다.
                </p>
              </div>
              <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
                <p className="text-sm font-semibold text-orange-300">플랫폼 관리</p>
                <p className="mt-2 text-sm leading-6 text-slate-300">
                  MyBiz 공개 사이트와 가격표, 공지, 결제 점검 상품을 관리합니다.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="section-card p-8 sm:p-10">
          <div className="space-y-6">
            <div className="space-y-2">
              <div className="flex h-14 w-14 items-center justify-center rounded-3xl bg-orange-100 text-orange-700">
                <Icons.Dashboard size={26} />
              </div>
              <h2 className="pt-2 font-display text-3xl font-black tracking-tight text-slate-900">이메일 로그인</h2>
              <p className="text-sm leading-6 text-slate-500">
                {shouldValidatePlatformAdmin
                  ? '플랫폼 관리자 권한이 있는 계정만 /admin 화면으로 이동합니다.'
                  : '매장 운영 권한이 있는 계정만 /dashboard 화면으로 이동합니다.'}
              </p>
            </div>

            {message ? <p className={getMessageClassName(message.tone)}>{message.text}</p> : null}

            <form className="rounded-3xl border border-slate-200 bg-white p-5" onSubmit={(event) => void handleEmailSignIn(event)}>
              <div className="flex items-start gap-4">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                  <Icons.Message size={20} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-slate-900">이메일 로그인</p>
                  <p className="mt-1 text-sm leading-6 text-slate-500">
                    {demoPasswordLoginEnabled
                      ? '이메일과 비밀번호를 입력해 관리자 화면에 로그인할 수 있습니다.'
                      : '체험용 이메일/비밀번호 로그인은 현재 비활성화 상태입니다.'}
                  </p>
                </div>
              </div>

              <div className="mt-4 grid gap-4">
                <label className="space-y-2">
                  <span className="field-label">이메일</span>
                  <input
                    autoComplete="username"
                    className="input-base"
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="mybiz.lab3@gmail.com"
                    type="email"
                    value={email}
                  />
                </label>
                <label className="space-y-2">
                  <span className="field-label">비밀번호</span>
                  <input
                    autoComplete="current-password"
                    className="input-base"
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="비밀번호를 입력해 주세요"
                    type="password"
                    value={password}
                  />
                </label>
              </div>

              {demoPasswordLoginEnabled ? (
                <div className="mt-4 rounded-xl bg-slate-50 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm text-slate-500">체험 계정으로 빠르게 확인하려면</p>
                    <button className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:border-slate-300" onClick={fillDemoCredentials} type="button">
                      데모 계정 채우기
                    </button>
                  </div>
                </div>
              ) : null}

              <button
                className="btn-primary mt-4 w-full justify-center"
                disabled={pendingMethod !== null}
                type="submit"
              >
                이메일로 로그인
              </button>
            </form>

            <div className="rounded-3xl border border-orange-200 bg-orange-50 p-5">
              <div className="flex items-start gap-4">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-orange-700">
                  <Icons.Zap size={20} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-slate-900">운영 대시보드 체험</p>
                  <p className="mt-1 text-sm leading-6 text-slate-600">
                    실제 데이터 없이 MyBiz 점주 화면을 둘러볼 수 있습니다.
                  </p>
                </div>
              </div>
              <Link className="btn-primary mt-4 w-full justify-center" to="/demo/dashboard">
                데모 대시보드 보기
              </Link>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-5 text-sm text-slate-600">
              <p className="font-semibold text-slate-900">정책 문서</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {LEGAL_LINKS.map((link) => (
                  <Link key={link.href} className="btn-secondary !px-3 !py-2" to={link.href}>
                    {link.label}
                  </Link>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link className="btn-secondary" to="/">
                공개 페이지로 돌아가기
              </Link>
              <Link className="btn-secondary" to="/pricing">
                요금제 보기
              </Link>
              <Link className="btn-secondary" to="/login?next=/admin">
                플랫폼 관리자 로그인
              </Link>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
