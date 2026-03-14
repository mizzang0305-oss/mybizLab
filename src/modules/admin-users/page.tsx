import { useQuery } from '@tanstack/react-query';

import { EmptyState } from '@/shared/components/EmptyState';
import { PageHeader } from '@/shared/components/PageHeader';
import { Panel } from '@/shared/components/Panel';
import { StatusBadge } from '@/shared/components/StatusBadge';
import { usePageMeta } from '@/shared/hooks/usePageMeta';
import { formatDateTime } from '@/shared/lib/format';
import { ADMIN_ROLE_LABELS, ADMIN_USER_STATUS_LABELS, INVITATION_STATUS_LABELS } from '@/shared/lib/platformConsole';
import { queryKeys } from '@/shared/lib/queryKeys';
import { listAdminUsers } from '@/shared/lib/services/platformConsoleService';

export function AdminUsersPage() {
  usePageMeta('관리자 계정', '플랫폼 운영자와 스토어 관리자 계정의 역할, 연결 스토어, 상태, 초대 여부를 관리하는 콘솔 화면입니다.');

  const adminUsersQuery = useQuery({
    queryKey: queryKeys.adminUsers,
    queryFn: listAdminUsers,
  });

  const users = adminUsersQuery.data || [];

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Admin users"
        title="관리자 계정"
        description="플랫폼 소유자, 운영자, 스토어 대표, 매니저 계정이 어떤 스토어에 연결돼 있는지 운영 관점에서 확인합니다."
      />

      <Panel title="관리자 계정 목록" subtitle="실제 auth 연동 전 단계에서도 계정 역할과 연결 정보를 같은 구조로 운영할 수 있도록 구성했습니다.">
        {users.length ? (
          <div className="overflow-x-auto">
            <table className="min-w-full border-separate border-spacing-y-3 text-sm">
              <thead>
                <tr className="text-left text-slate-500">
                  <th className="px-4 py-2 font-semibold">이름</th>
                  <th className="px-4 py-2 font-semibold">이메일</th>
                  <th className="px-4 py-2 font-semibold">역할</th>
                  <th className="px-4 py-2 font-semibold">연결 스토어</th>
                  <th className="px-4 py-2 font-semibold">상태</th>
                  <th className="px-4 py-2 font-semibold">최근 접속</th>
                  <th className="px-4 py-2 font-semibold">초대 여부</th>
                  <th className="px-4 py-2 font-semibold">액션</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id} className="bg-white shadow-[0_18px_45px_-30px_rgba(15,23,42,0.3)]">
                    <td className="rounded-l-3xl px-4 py-4 align-top">
                      <div className="space-y-1">
                        <p className="font-semibold text-slate-900">{user.name}</p>
                        <p className="text-xs text-slate-500">{user.profile_id || 'profile pending'}</p>
                      </div>
                    </td>
                    <td className="px-4 py-4 align-top text-slate-600">{user.email}</td>
                    <td className="px-4 py-4 align-top text-slate-600">{ADMIN_ROLE_LABELS[user.role]}</td>
                    <td className="px-4 py-4 align-top text-slate-600">
                      {user.linkedStores.length ? user.linkedStores.join(', ') : '연결 예정'}
                    </td>
                    <td className="px-4 py-4 align-top">
                      <div className="space-y-2">
                        <StatusBadge status={user.status} />
                        <p className="text-xs text-slate-500">{ADMIN_USER_STATUS_LABELS[user.status]}</p>
                      </div>
                    </td>
                    <td className="px-4 py-4 align-top text-slate-600">{formatDateTime(user.last_sign_in_at)}</td>
                    <td className="px-4 py-4 align-top text-slate-600">{INVITATION_STATUS_LABELS[user.invitation_status]}</td>
                    <td className="rounded-r-3xl px-4 py-4 align-top">
                      <div className="flex flex-col gap-2">
                        <button className="btn-secondary !px-3 !py-2" type="button">
                          초대 예정
                        </button>
                        <button className="btn-secondary !px-3 !py-2" type="button">
                          연결 확인
                        </button>
                        <button className="btn-secondary !px-3 !py-2" type="button">
                          재초대
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState title="관리자 계정이 없습니다" description="승인된 스토어가 생기면 owner 후보 이메일을 기준으로 관리자 계정이 여기에 연결됩니다." />
        )}
      </Panel>
    </div>
  );
}
