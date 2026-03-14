import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { PageHeader } from '@/shared/components/PageHeader';
import { Panel } from '@/shared/components/Panel';
import { StatusBadge } from '@/shared/components/StatusBadge';
import { queryKeys } from '@/shared/lib/queryKeys';
import { listContracts, saveContract } from '@/shared/lib/services/mvpService';
import { useCurrentStore } from '@/shared/hooks/useCurrentStore';
import type { ContractStatus } from '@/shared/types/models';

const initialForm = {
  title: '',
  counterparty: '',
  status: 'draft' as ContractStatus,
  file_url: '',
  metadata: { note: '' },
};

export function ContractsPage() {
  const { currentStore } = useCurrentStore();
  const queryClient = useQueryClient();
  const [form, setForm] = useState(initialForm);

  const contractsQuery = useQuery({
    queryKey: queryKeys.contracts(currentStore?.id || ''),
    queryFn: () => listContracts(currentStore!.id),
    enabled: Boolean(currentStore),
  });

  const saveMutation = useMutation({
    mutationFn: () => saveContract(currentStore!.id, form),
    onSuccess: async () => {
      setForm(initialForm);
      await queryClient.invalidateQueries({ queryKey: queryKeys.contracts(currentStore!.id) });
    },
  });

  if (!currentStore) {
    return null;
  }

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Contracts"
        title="전자계약"
        description="계약 목록, 계약 생성, 파일 URL/메타데이터 저장 흐름을 제공합니다."
      />

      <div className="grid gap-8 xl:grid-cols-[0.75fr_1.25fr]">
        <Panel title="계약 생성">
          <div className="grid gap-4">
            <label>
              <span className="field-label">계약명</span>
              <input className="input-base" onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} value={form.title} />
            </label>
            <label>
              <span className="field-label">상대방</span>
              <input className="input-base" onChange={(event) => setForm((current) => ({ ...current, counterparty: event.target.value }))} value={form.counterparty} />
            </label>
            <label>
              <span className="field-label">상태</span>
              <select className="input-base" onChange={(event) => setForm((current) => ({ ...current, status: event.target.value as ContractStatus }))} value={form.status}>
                <option value="draft">draft</option>
                <option value="sent">sent</option>
                <option value="signed">signed</option>
              </select>
            </label>
            <label>
              <span className="field-label">파일 URL</span>
              <input className="input-base" onChange={(event) => setForm((current) => ({ ...current, file_url: event.target.value }))} placeholder="업로드 UI placeholder 가능" value={form.file_url} />
            </label>
            <label>
              <span className="field-label">메모</span>
              <textarea className="input-base min-h-28" onChange={(event) => setForm((current) => ({ ...current, metadata: { note: event.target.value } }))} value={form.metadata.note} />
            </label>
            <button className="btn-primary" onClick={() => saveMutation.mutate()} type="button">
              계약 저장
            </button>
          </div>
        </Panel>

        <Panel title="계약 목록">
          <div className="space-y-3">
            {contractsQuery.data?.map((contract) => (
              <div key={contract.id} className="rounded-3xl border border-slate-200 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-bold text-slate-900">{contract.title}</p>
                    <p className="text-sm text-slate-500">{contract.counterparty}</p>
                    {contract.file_url ? <a className="mt-2 inline-flex text-sm font-semibold text-orange-700" href={contract.file_url}>파일 열기</a> : <p className="mt-2 text-sm text-slate-400">파일 업로드 placeholder</p>}
                  </div>
                  <StatusBadge status={contract.status} />
                </div>
                {contract.metadata.note ? <p className="mt-3 text-sm text-slate-500">{contract.metadata.note}</p> : null}
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}
