import { useRef, useState } from 'react';
import { ArrowRight, ClipboardCheck, Copy, Download } from 'lucide-react';
import type { InquiryHandoffDraft } from './inquiryHandoff';

export function InquiryHandoffPanel({ draft }: { draft: InquiryHandoffDraft }) {
  const textRef = useRef<HTMLTextAreaElement>(null);
  const [notice, setNotice] = useState('아직 접수되지 않음 · 웹사이트 DB 저장 없음');

  async function copyDraft() {
    try {
      if (!navigator.clipboard?.writeText) throw new Error('CLIPBOARD_UNAVAILABLE');
      await navigator.clipboard.writeText(draft.body);
      setNotice('문의 본문을 복사했습니다. 메일 앱에 붙여 넣고 최종 발송해 주세요. 아직 접수된 것은 아닙니다.');
    } catch {
      textRef.current?.focus();
      textRef.current?.select();
      setNotice('자동 복사를 사용할 수 없습니다. 선택된 문의 본문을 직접 복사해 주세요.');
    }
  }

  function downloadDraft() {
    const url = URL.createObjectURL(new Blob(['\uFEFF', draft.draftText], { type: 'text/plain;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'mybizlab-development-inquiry.txt';
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  const actionClass = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-5 text-xs font-black focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-[#102a2e]';
  return (
    <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4" data-handoff-mode={draft.transferMode} data-inquiry-recipient={draft.recipient} data-inquiry-status="review-ready">
      <p className="flex items-center gap-2 text-sm font-black text-emerald-900"><ClipboardCheck size={17} />요청서 구성이 완료되었습니다.</p>
      <p className="mt-2 text-xs leading-5 text-emerald-900">입력한 내용을 보존했습니다. 받는 사람: <strong>{draft.recipient}</strong></p>
      <label className="mt-4 block text-xs font-bold text-emerald-900">
        전달할 문의 본문 전체
        <textarea className="mt-2 min-h-64 w-full resize-y rounded-xl border border-emerald-300 bg-white p-3 text-xs leading-6 text-[#071019]" data-inquiry-handoff-body readOnly ref={textRef} value={draft.body} />
      </label>
      <p className="mt-2 text-xs leading-5 text-emerald-900">이 화면을 유지한 채 메일 작성 창을 엽니다. 메일 앱에서 마지막 ‘보내기’를 눌러야 전달됩니다. 새로고침·페이지 이동 전에는 본문을 복사하거나 요청서를 저장해 주세요.</p>
      {!draft.mailtoHref ? <p className="mt-3 text-xs font-bold leading-5 text-amber-900">요청서가 길어 메일 링크에서 본문이 누락되지 않도록 자동 채우기를 사용하지 않습니다. 먼저 본문을 복사한 뒤 메일 앱에 붙여 넣어 주세요.</p> : null}
      <div className="mt-4 flex flex-wrap gap-2">
        <a className={`${actionClass} bg-[#102a2e] text-white`} data-inquiry-action="email" href={draft.mailtoHref ?? draft.recipientOnlyHref} onClick={() => setNotice('메일 작성 창 열기를 요청했습니다. 실제 발송·수신 여부는 이 화면에서 확인할 수 없습니다.')}>
          {draft.mailtoHref ? '개발 상담 보내기 · 메일 작성' : '메일 앱 열기 · 본문 붙여넣기'}<ArrowRight size={14} />
        </a>
        <button className={`${actionClass} border border-emerald-800/30 text-emerald-900`} data-inquiry-action="copy" onClick={copyDraft} type="button"><Copy size={14} />문의 본문 복사</button>
        <button className={`${actionClass} border border-emerald-800/30 text-emerald-900`} data-inquiry-action="download" onClick={downloadDraft} type="button"><Download size={14} />요청서 .txt 저장</button>
      </div>
      <p aria-live="polite" className="mt-3 text-xs leading-5 text-emerald-900" role="status">{notice}</p>
    </div>
  );
}
