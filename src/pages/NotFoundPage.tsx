import { Link } from 'react-router-dom';

import { EmptyState } from '@/shared/components/EmptyState';

export function NotFoundPage() {
  return (
    <div className="page-shell py-20">
      <EmptyState
        title="페이지를 찾을 수 없습니다"
        description="요청한 주소에 연결된 화면이 없습니다. 스토어 slug 또는 운영 경로를 다시 확인해 주세요."
        action={
          <div className="flex flex-wrap gap-3">
            <Link className="btn-primary" to="/">
              홈으로
            </Link>
            <Link className="btn-secondary" to="/login">
              대시보드
            </Link>
          </div>
        }
      />
    </div>
  );
}
