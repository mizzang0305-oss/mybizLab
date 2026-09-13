import { useEffect } from 'react';
import { Link } from 'react-router-dom';

export function DemoPreviewModal({ onClose, open }: { onClose: () => void; open: boolean }) {
  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose, open]);

  if (!open) return null;

  return (
    <div
      aria-modal="true"
      className="fixed inset-0 z-[80] flex items-end justify-center bg-black/75 px-4 py-6 backdrop-blur-xl sm:items-center"
      data-demo-modal="homepage"
      role="dialog"
      onClick={(event) => {
        if (event.currentTarget === event.target) onClose();
      }}
    >
      <div className="w-full max-w-5xl rounded-[2rem] border border-white/10 bg-[#080b12] p-6 text-white shadow-2xl sm:p-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.24em] text-orange-400">MYBIZ FIELD DEMO</p>
            <h2 className="mt-3 text-3xl font-black tracking-[-0.04em] sm:text-4xl">작업 한 건이 끝까지 연결되는 모습을 보세요</h2>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-white/55 sm:text-base">
              현장 증빙부터 고객 확인, 결제 요청, 콘텐츠 제작까지 실제 운영 화면처럼 구성한 데모 흐름입니다.
            </p>
          </div>
          <button className="rounded-2xl border border-white/10 px-4 py-2 text-sm font-bold text-white/70" onClick={onClose} type="button">
            닫기
          </button>
        </div>

        <div className="mt-7 grid gap-4 md:grid-cols-3">
          <article className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-5">
            <p className="text-xs font-black text-orange-400">업체 화면</p>
            <h3 className="mt-2 text-xl font-black">현장 작업 관리</h3>
            <p className="mt-2 text-sm leading-6 text-white/55">작업을 등록하고 계약 옵션, 담당자, 전후 사진, 승인 상태를 한 화면에서 관리합니다.</p>
            <Link className="mt-5 inline-flex rounded-xl bg-orange-600 px-4 py-2.5 text-sm font-black" onClick={onClose} to="/demo/dashboard">
              데모 대시보드 보기
            </Link>
          </article>

          <article className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-5">
            <p className="text-xs font-black text-orange-400">고객 화면</p>
            <h3 className="mt-2 text-xl font-black">확인 링크</h3>
            <p className="mt-2 text-sm leading-6 text-white/55">가입 없이 전후 사진을 보고 완료 확인 또는 재작업 요청을 남기는 고객 경험입니다.</p>
            <Link className="mt-5 inline-flex rounded-xl border border-white/15 px-4 py-2.5 text-sm font-black" onClick={onClose} to="/features">
              고객 확인 흐름 보기
            </Link>
          </article>

          <article className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-5">
            <p className="text-xs font-black text-orange-400">성장 자동화</p>
            <h3 className="mt-2 text-xl font-black">증빙 → 콘텐츠</h3>
            <p className="mt-2 text-sm leading-6 text-white/55">홍보 활용 동의가 있는 작업만 블로그와 쇼츠·릴스용 콘텐츠 후보로 바꿉니다.</p>
            <Link className="mt-5 inline-flex rounded-xl border border-white/15 px-4 py-2.5 text-sm font-black" onClick={onClose} to="/pricing">
              요금제 보기
            </Link>
          </article>
        </div>
      </div>
    </div>
  );
}
