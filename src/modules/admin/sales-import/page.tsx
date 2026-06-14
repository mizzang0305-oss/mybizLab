import { useState, type ChangeEvent } from 'react';

import { supabase } from '@/integrations/supabase/client';
import { EmptyState } from '@/shared/components/EmptyState';
import { PageHeader } from '@/shared/components/PageHeader';
import { Panel } from '@/shared/components/Panel';
import { useCurrentStore } from '@/shared/hooks/useCurrentStore';
import { usePageMeta } from '@/shared/hooks/usePageMeta';
import { getLaunchGateStatus } from '@/shared/lib/launchGates';
import { resolveServerApiUrl } from '@/shared/lib/serverApiUrl';
import { SALES_EXCEL_APPLY_APPROVAL_PHRASE } from '@/server/mybiz/imports/salesExcelTypes';
import type { SanitizedSalesExcelPreviewResponse } from '@/server/mybiz/imports/salesExcelTypes';

interface PreviewApiPayload {
  data?: SanitizedSalesExcelPreviewResponse;
  error?: string;
  ok: boolean;
}

function fileToBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read the selected Excel file.'));
    reader.onload = () => resolve(String(reader.result || ''));
    reader.readAsDataURL(file);
  });
}

async function getAccessToken() {
  if (!supabase) {
    return null;
  }

  const { data, error } = await supabase.auth.getSession();
  if (error) {
    throw new Error(`Supabase session lookup failed: ${error.message}`);
  }

  return data.session?.access_token || null;
}

export function SalesImportPage() {
  const { currentStore } = useCurrentStore();
  const [approvalPhrase, setApprovalPhrase] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [sanitizedPreview, setSanitizedPreview] = useState<SanitizedSalesExcelPreviewResponse | null>(null);

  const previewGate = getLaunchGateStatus('salesExcelImportEnabled');
  const applyGate = getLaunchGateStatus('salesExcelImportApplyEnabled');
  const broadWriteGate = getLaunchGateStatus('broadDbWriteEnabled');
  const canApply =
    Boolean(sanitizedPreview) &&
    applyGate.enabled &&
    broadWriteGate.enabled &&
    approvalPhrase === SALES_EXCEL_APPLY_APPROVAL_PHRASE;

  usePageMeta('Excel sales import', 'Preview Excel sales sync results before any write path is approved.');

  if (!currentStore) {
    return <EmptyState title="매장을 먼저 선택하세요" description="엑셀 매출 동기화는 store_id 범위가 확정된 뒤에만 실행됩니다." />;
  }

  const currentStoreId = currentStore.id;

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const selectedFile = event.target.files?.[0] || null;
    setFile(selectedFile);
    setSanitizedPreview(null);
    setMessage(null);
  }

  async function handlePreview() {
    if (!file) {
      setMessage('엑셀 파일을 먼저 선택하세요.');
      return;
    }

    setIsPreviewing(true);
    setMessage(null);

    try {
      const accessToken = await getAccessToken();
      if (!accessToken) {
        throw new Error('Live Supabase session is required for server-side preview authorization.');
      }

      const response = await fetch(resolveServerApiUrl('/api/admin/imports/sales-excel/preview'), {
        body: JSON.stringify({
          fileBase64: await fileToBase64(file),
          fileName: file.name,
          storeId: currentStoreId,
        }),
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'content-type': 'application/json',
        },
        method: 'POST',
      });
      const payload = (await response.json()) as PreviewApiPayload;
      if (!response.ok || !payload.ok || !payload.data) {
        throw new Error(payload.error || `Preview failed with HTTP ${response.status}.`);
      }

      setSanitizedPreview(payload.data);
      setMessage('Preview completed. Apply remains blocked until the write gates are approved.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Preview failed.');
    } finally {
      setIsPreviewing(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="매출 데이터 가져오기"
        title="Excel 매출 동기화"
        description="엑셀 매출 파일을 먼저 preview로 검증하고, 승인된 write gate가 열리기 전에는 실제 DB 반영을 막습니다."
      />

      <Panel title="업로드 preview" subtitle="원본 row와 거래처명은 화면에 표시하지 않고 count, date range, checksum만 확인합니다.">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px]">
          <label>
            <span className="field-label">Excel file (.xls, .xlsx)</span>
            <input accept=".xls,.xlsx" className="input-base" onChange={handleFileChange} type="file" />
          </label>
          <div className="flex items-end">
            <button className="btn-primary w-full" disabled={!previewGate.enabled || !file || isPreviewing} onClick={handlePreview} type="button">
              {isPreviewing ? 'Previewing...' : 'Preview'}
            </button>
          </div>
        </div>
        {message ? <p className="mt-4 text-sm font-semibold text-slate-600">{message}</p> : null}
      </Panel>

      <Panel title="Diff summary" subtitle="겹치는 날짜 범위 안에서 insert/update/soft-delete 후보만 표시합니다.">
        {sanitizedPreview ? (
          <div className="grid gap-3 text-sm sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="font-semibold text-slate-500">date range</p>
              <p className="mt-1 font-bold text-slate-950">
                {sanitizedPreview.dateRange.from} - {sanitizedPreview.dateRange.to}
              </p>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="font-semibold text-slate-500">insert / update</p>
              <p className="mt-1 font-bold text-slate-950">
                {sanitizedPreview.summary.insertCount} / {sanitizedPreview.summary.updateCount}
              </p>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="font-semibold text-slate-500">soft-delete / unchanged</p>
              <p className="mt-1 font-bold text-slate-950">
                {sanitizedPreview.summary.deleteCount} / {sanitizedPreview.summary.unchangedCount}
              </p>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="font-semibold text-slate-500">rejected</p>
              <p className="mt-1 font-bold text-slate-950">{sanitizedPreview.rejectedCount}</p>
            </div>
          </div>
        ) : (
          <p className="text-sm text-slate-500">아직 preview 결과가 없습니다.</p>
        )}
      </Panel>

      <Panel title="Apply gate" subtitle="이번 PR의 production write path는 기본 disabled입니다.">
        <label>
          <span className="field-label">Approval phrase</span>
          <input
            className="input-base"
            onChange={(event) => setApprovalPhrase(event.target.value)}
            placeholder={SALES_EXCEL_APPLY_APPROVAL_PHRASE}
            value={approvalPhrase}
          />
        </label>
        <button className="btn-secondary mt-4" disabled={!canApply} type="button">
          Apply disabled until gates are approved
        </button>
        <p className="mt-3 text-sm text-slate-500">
          salesExcelImportApplyEnabled={String(applyGate.enabled)}, broadDbWriteEnabled={String(broadWriteGate.enabled)}
        </p>
      </Panel>
    </div>
  );
}
