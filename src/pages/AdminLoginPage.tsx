import { FormEvent, useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';

import { Icons } from '@/shared/components/Icons';
import { usePageMeta } from '@/shared/hooks/usePageMeta';
import {
  DEMO_ADMIN_CREDENTIALS,
  createDemoAdminSession,
  hasDashboardAccess,
  isDemoPasswordLoginEnabled,
  sanitizeAdminNextPath,
  useAdminSessionStore,
} from '@/shared/lib/adminSession';
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
  const session = useAdminSessionStore((state) => state.session);
  const setSession = useAdminSessionStore((state) => state.setSession);
  const [pendingMethod, setPendingMethod] = useState<LoginMethod | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState<MessageState | null>(null);
  const demoPasswordLoginEnabled = isDemoPasswordLoginEnabled();

  const nextPath = sanitizeAdminNextPath(searchParams.get('next'));

  usePageMeta(
    '관리자 로그인',
    '스토어 운영 현황, 고객, 예약, 매출, AI 운영 리포트를 확인하는 관리자 로그인 페이지입니다.',
  );

  if (hasDashboardAccess(session)) {
    return <Navigate replace to={nextPath} />;
  }

  async function signInWithDemoAccess(method: LoginMethod, options?: { email?: string; fullName?: string }) {
    try {
      setPendingMethod(method);
      setMessage(
        method === 'demo'
          ? { tone: 'info', text: '데모 관리자 대시보드를 준비하고 있습니다.' }
          : method === 'google'
            ? { tone: 'info', text: 'Google 체험 로그인을 준비하고 있습니다.' }
            : { tone: 'info', text: '이메일 체험 로그인을 준비하고 있습니다.' },
      );

      const nextSession = await createDemoAdminSession({
        email: options?.email,
        fullName: options?.fullName,
      });

      setSession(nextSession);
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
      setMessage({
        tone: 'error',
        text: '이메일과 비밀번호를 입력해 주세요.',
      });
      return;
    }

    if (!demoPasswordLoginEnabled || !DEMO_ADMIN_CREDENTIALS.password) {
      setMessage({
        tone: 'error',
        text: '이메일/비밀번호 체험 로그인은 현재 비활성화 상태입니다. 데모 대시보드 또는 Google 체험 로그인을 사용해 주세요.',
      });
      return;
    }

    if (
      normalizedEmail !== DEMO_ADMIN_CREDENTIALS.email ||
      normalizedPassword !== DEMO_ADMIN_CREDENTIALS.password
    ) {
      setMessage({
        tone: 'error',
        text: `체험 환경에서는 ${DEMO_ADMIN_CREDENTIALS.email} 계정과 설정된 데모 비밀번호를 사용해 주세요.`,
      });
      return;
    }

    await signInWithDemoAccess('email', { email: normalizedEmail });
  }

  return (
    <main className="page-shell py-12 sm:py-16">
      <div className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr]">
        <section className="relative overflow-hidden rounded-[36px] bg-slate-950 px-8 py-10 text-white shadow-[0_45px_90px_-40px_rgba(15,23,42,0.85)] sm:px-10 sm:py-12">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(236,91,19,0.55),_transparent_35%),radial-gradient(circle_at_bottom_right,_rgba(251,146,60,0.18),_transparent_25%)]" />
          <div className="relative space-y-6">
            <span className="inline-flex rounded-full border border-white/15 bg-white/10 px-4 py-2 text-xs font-bold uppercase tracking-[0.2em] text-orange-200">
              Admin Access
            </span>

            <div className="space-y-4">
              <h1 className="font-display text-4xl font-black tracking-tight sm:text-5xl">운영 대시보드 로그인</h1>
              <p className="max-w-2xl text-base leading-7 text-slate-300 sm:text-lg">
                스토어 운영 현황, 고객 관리, 예약 흐름, 매출 분석, AI 운영 리포트를 한 화면에서 확인할 수 있는 관리자 진입 화면입니다.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
                <p className="text-sm font-semibold text-orange-300">지금 필요한 운영 현황</p>
                <p className="mt-2 text-sm leading-6 text-slate-300">
                  오늘 주문, 예약 흐름, 고객 상태를 빠르게 확인하고 바로 대응할 수 있습니다.
                </p>
              </div>
              <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
                <p className="text-sm font-semibold text-orange-300">AI 운영 리포트</p>
                <p className="mt-2 text-sm leading-6 text-slate-300">
                  매장 운영 결과와 개선 제안을 빠르게 검토하고 실행으로 이어갈 수 있습니다.
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
              <h2 className="pt-2 font-display text-3xl font-black tracking-tight text-slate-900">로그인 방법 선택</h2>
              <p className="text-sm leading-6 text-slate-500">
                필요한 방식으로 로그인하고 바로 관리자 대시보드로 이동하세요.
              </p>
            </div>

            {message ? <p className={getMessageClassName(message.tone)}>{message.text}</p> : null}

            <div className="space-y-4">
              <div className="rounded-3xl border border-slate-200 bg-white p-5">
                <div className="flex items-start gap-4">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                    <Icons.Globe size={20} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-slate-900">Google 체험 로그인</p>
                    <p className="mt-1 text-sm leading-6 text-slate-500">
                      가장 빠르게 관리자 대시보드를 체험할 수 있는 진입 방식입니다.
                    </p>
                  </div>
                </div>
                <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-xs leading-5 text-slate-500">
                    체험 환경에서는 Google 선택 후 데모 관리자 계정으로 연결됩니다.
                  </p>
                  <button
                    className="btn-secondary justify-center"
                    disabled={pendingMethod !== null}
                    onClick={() => void signInWithDemoAccess('google', { email: DEMO_ADMIN_CREDENTIALS.email })}
                    type="button"
                  >
                    Google로 로그인
                  </button>
                </div>
              </div>

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
                      placeholder="demo@mybizlab.ai"
                      type="email"
                      value={email}
                    />
                  </label>
                  <label className="space-y-2">
                    <span className="field-label">비밀번호</span>
                    <input
                      autoComplete="current-password"
                      className="input-base"
                      disabled={!demoPasswordLoginEnabled}
                      onChange={(event) => setPassword(event.target.value)}
                      placeholder={
                        demoPasswordLoginEnabled
                          ? '비밀번호를 입력해 주세요.'
                          : '비밀번호 로그인은 현재 비활성화되어 있습니다.'
                      }
                      type="password"
                      value={password}
                    />
                  </label>
                </div>

                <div className="mt-4 rounded-3xl bg-slate-50 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="space-y-1 text-sm text-slate-600">
                      <p className="font-semibold text-slate-900">체험용 이메일 로그인</p>
                      <p>이메일: {DEMO_ADMIN_CREDENTIALS.email}</p>
                      <p>비밀번호: {demoPasswordLoginEnabled ? 'env로 설정됨' : '미설정'}</p>
                    </div>
                    <button className="btn-secondary !px-4 !py-2" onClick={fillDemoCredentials} type="button">
                      데모 계정 채우기
                    </button>
                  </div>
                </div>

                <button
                  className="btn-primary mt-4 w-full justify-center"
                  disabled={pendingMethod !== null || !demoPasswordLoginEnabled}
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
                    <p className="font-semibold text-slate-900">데모 로그인</p>
                    <p className="mt-1 text-sm leading-6 text-slate-600">
                      가장 빠르게 MyBizLab 운영 대시보드를 체험할 수 있는 추천 진입 방식입니다.
                    </p>
                  </div>
                </div>
                <button
                  className="btn-primary mt-4 w-full justify-center"
                  disabled={pendingMethod !== null}
                  onClick={() => void signInWithDemoAccess('demo', { email: DEMO_ADMIN_CREDENTIALS.email })}
                  type="button"
                >
                  데모 대시보드 열기
                </button>
              </div>
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
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
