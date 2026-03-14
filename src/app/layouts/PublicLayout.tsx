import { Link, Outlet } from 'react-router-dom';

import { Icons } from '@/shared/components/Icons';

export function PublicLayout() {
  return (
    <div className="min-h-screen bg-[#f6f2ea]">
      <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-[#f6f2ea]/90 backdrop-blur">
        <div className="page-shell flex items-center justify-between py-4">
          <Link className="flex items-center gap-3" to="/">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-orange-600 text-white shadow-lg shadow-orange-500/20">
              <Icons.Store size={22} />
            </div>
            <div>
              <p className="font-display text-xl font-black text-slate-900">My Biz Lab</p>
              <p className="text-xs text-slate-500">Store-aware operations SaaS MVP</p>
            </div>
          </Link>
          <nav className="hidden items-center gap-3 sm:flex">
            <Link className="btn-secondary" to="/onboarding">
              온보딩
            </Link>
            <Link className="btn-primary" to="/login">
              대시보드
            </Link>
          </nav>
        </div>
      </header>

      <Outlet />

      <footer className="mt-16 border-t border-slate-200/70 bg-white/60">
        <div className="page-shell flex flex-col gap-6 py-8 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-display text-lg font-extrabold text-slate-900">mybiz.ai.kr/{'{storeSlug}'}</p>
            <p className="text-sm text-slate-500">배포 시 slug 기반 스토어 진입 구조로 쉽게 전환할 수 있도록 설계되었습니다.</p>
          </div>
          <div className="text-sm text-slate-500">Mock repository + Supabase/Gemini integration points ready</div>
        </div>
      </footer>
    </div>
  );
}
