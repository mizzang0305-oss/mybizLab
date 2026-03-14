import { Link } from 'react-router-dom';

import { AppFooter } from '@/shared/components/AppFooter';
import { EmptyState } from '@/shared/components/EmptyState';
import { usePageMeta } from '@/shared/hooks/usePageMeta';

export function NotFoundPage() {
  usePageMeta('페이지를 찾을 수 없음', '요청하신 페이지를 찾을 수 없습니다.');

  return (
    <div className="flex min-h-screen flex-col bg-[#f6f2ea]">
      <main className="page-shell flex-1 py-20">
        <EmptyState
          action={
            <div className="flex flex-wrap gap-3">
              <Link className="btn-primary" to="/">
                홈페이지
              </Link>
              <Link className="btn-secondary" to="/login">
                관리자 로그인
              </Link>
            </div>
          }
          description="요청한 주소가 존재하지 않거나 이동되었습니다. 홈페이지, 로그인, 또는 스토어 공개 URL을 다시 확인해 주세요."
          title="페이지를 찾을 수 없습니다"
        />
      </main>
      <AppFooter />
    </div>
  );
}
