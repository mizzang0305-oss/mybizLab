/**
 * OAuthSetupGuide.tsx
 *
 * 비개발자(점주)도 따라할 수 있는 소셜 플랫폼 OAuth 설정 가이드 모달.
 * 단계별 상세 안내, 복사 버튼, 외부 링크를 제공합니다.
 */
import { useState } from 'react';
import { type OAuthGuide, ALL_GUIDES } from './OAuthGuideData';
import { getDefaultRedirectUri } from '@/shared/lib/services/storeOAuthCredentialsService';
import type { OAuthProvider as StoreOAuthProvider } from '@/shared/lib/services/storeOAuthCredentialsService';

function useCopy() {
  const [copied, setCopied] = useState<string | null>(null);
  function copy(text: string, key: string) {
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(key);
      setTimeout(() => setCopied(null), 2000);
    });
  }
  return { copied, copy };
}

function StepItem({
  step,
  index,
  accentColor,
  redirectUri,
  copied,
  onCopy,
}: {
  step: OAuthGuide['steps'][number];
  index: number;
  accentColor: string;
  redirectUri: string;
  copied: string | null;
  onCopy: (text: string, key: string) => void;
}) {
  const [open, setOpen] = useState(index === 0);

  return (
    <div
      className={`rounded-2xl border transition-all duration-200 ${
        open ? 'border-slate-200 bg-white shadow-sm' : 'border-slate-100 bg-slate-50'
      }`}
    >
      {/* Step header — clickable */}
      <button
        className="flex w-full items-start gap-4 p-4 text-left"
        onClick={() => setOpen(!open)}
        type="button"
      >
        {/* Number badge */}
        <div
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-black text-white"
          style={{ background: accentColor === '#FEE500' ? '#f59e0b' : accentColor }}
        >
          {index + 1}
        </div>
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-black ${open ? 'text-slate-900' : 'text-slate-600'}`}>
            {step.title}
          </p>
          {!open && step.desc && (
            <p className="mt-0.5 text-xs text-slate-400 line-clamp-1">{step.desc}</p>
          )}
        </div>
        <span className="shrink-0 text-xs text-slate-400">{open ? '▲' : '▼'}</span>
      </button>

      {/* Step body */}
      {open && (
        <div className="px-4 pb-5 pt-1 space-y-4">
          {/* Description */}
          <p className="text-sm leading-6 text-slate-600">{step.desc}</p>

          {/* Substeps — click path */}
          {step.substeps && step.substeps.length > 0 && (
            <div className="rounded-xl bg-slate-50 p-3">
              <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-slate-400">
                순서대로 클릭
              </p>
              <div className="flex flex-wrap items-center gap-1.5">
                {step.substeps.map((sub, i) => (
                  <span key={i} className="flex items-center gap-1.5">
                    <span className="rounded-lg bg-white px-2.5 py-1.5 text-xs font-bold text-slate-700 shadow-sm ring-1 ring-slate-200">
                      {sub}
                    </span>
                    {i < step.substeps!.length - 1 && (
                      <span className="text-xs text-slate-300">→</span>
                    )}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Redirect URI copy box */}
          {step.copyValue === 'redirectUri' && (
            <div className="rounded-xl border border-blue-100 bg-blue-50 p-3">
              <p className="text-xs font-bold text-blue-800 mb-2">
                📋 아래 주소를 복사해서 <strong>{step.inputHint || '해당 입력란'}</strong>에 붙여넣으세요
              </p>
              <div className="flex items-center gap-2 rounded-lg bg-white px-3 py-2 ring-1 ring-blue-100">
                <code className="flex-1 min-w-0 truncate text-xs font-mono text-blue-700 select-all">
                  {redirectUri}
                </code>
                <button
                  className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-black transition-all ${
                    copied === 'redirectUri'
                      ? 'bg-emerald-500 text-white'
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}
                  onClick={() => onCopy(redirectUri, 'redirectUri')}
                  type="button"
                >
                  {copied === 'redirectUri' ? '✓ 복사됨' : '복사'}
                </button>
              </div>
            </div>
          )}

          {/* Highlight (화면에서 찾아야 할 텍스트) */}
          {step.highlight && (
            <div className="flex items-center gap-2 rounded-xl border border-amber-100 bg-amber-50 px-3 py-2.5">
              <span className="text-sm">🔍</span>
              <p className="text-xs font-semibold text-amber-800">
                화면에서 <span className="rounded bg-amber-200 px-1.5 py-0.5 font-black">"{step.highlight}"</span> 를 찾으세요
              </p>
            </div>
          )}

          {/* External link */}
          {step.link && (
            <a
              className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-bold text-white hover:bg-slate-700 transition-colors"
              href={step.link}
              rel="noopener noreferrer"
              target="_blank"
            >
              🔗 {step.linkLabel || '열기'}
              <span className="text-slate-400">↗</span>
            </a>
          )}

          {/* Note / tip */}
          {step.note && (
            <div className="flex gap-2 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5">
              <span className="shrink-0 text-sm">💡</span>
              <p className="text-xs leading-5 text-slate-600">{step.note}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function OAuthSetupGuideModal({
  providerKey,
  onClose,
}: {
  providerKey: string;
  onClose: () => void;
}) {
  const guide = ALL_GUIDES[providerKey];
  const { copied, copy } = useCopy();
  const redirectUri = getDefaultRedirectUri(providerKey as StoreOAuthProvider);

  if (!guide) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 py-10"
      style={{ background: 'rgba(0,0,0,0.60)', backdropFilter: 'blur(6px)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl rounded-3xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-center gap-4 rounded-t-3xl px-6 py-5"
          style={{
            background:
              guide.color === '#FEE500'
                ? 'linear-gradient(135deg, #fef9c3, #fde68a)'
                : guide.color === '#FF0000'
                ? 'linear-gradient(135deg, #fee2e2, #fecaca)'
                : guide.color === '#03C75A'
                ? 'linear-gradient(135deg, #d1fae5, #a7f3d0)'
                : 'linear-gradient(135deg, #f1f5f9, #e2e8f0)',
          }}
        >
          <span className="text-4xl">{guide.icon}</span>
          <div className="flex-1">
            <p className="text-base font-black text-slate-900">
              {guide.label} 연동 설정 방법
            </p>
            <p className="mt-0.5 text-xs text-slate-600">{guide.summary}</p>
            <div className="mt-1.5 flex items-center gap-3">
              <span className="inline-flex items-center gap-1 rounded-full bg-white/70 px-2.5 py-0.5 text-xs font-bold text-slate-600">
                ⏱ 약 {guide.estimatedMinutes}분 소요
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-white/70 px-2.5 py-0.5 text-xs font-bold text-slate-600">
                📋 {guide.steps.length}단계
              </span>
            </div>
          </div>
          <button
            className="rounded-full p-2 hover:bg-white/50 text-slate-500 hover:text-slate-700 transition"
            onClick={onClose}
            type="button"
          >
            ✕
          </button>
        </div>

        {/* Where to find summary */}
        <div className="mx-6 mt-4 rounded-2xl bg-emerald-50 border border-emerald-100 px-4 py-3">
          <p className="text-xs font-black text-emerald-800 mb-2">✅ 최종 목표: 이 두 가지를 찾아서 아래에 입력하면 완료!</p>
          <div className="space-y-1">
            <p className="text-xs text-emerald-700">
              <span className="font-bold">Client ID 위치:</span> {guide.whereToFind.clientIdPath}
            </p>
            <p className="text-xs text-emerald-700">
              <span className="font-bold">Client Secret 위치:</span> {guide.whereToFind.clientSecretPath}
            </p>
          </div>
        </div>

        {/* Steps */}
        <div className="space-y-3 p-6">
          {guide.steps.map((step, i) => (
            <StepItem
              key={i}
              step={step}
              index={i}
              accentColor={guide.color}
              redirectUri={redirectUri}
              copied={copied}
              onCopy={copy}
            />
          ))}
        </div>

        {/* Footer */}
        <div className="rounded-b-3xl border-t border-slate-100 bg-slate-50 px-6 py-4 flex items-center justify-between gap-3">
          <p className="text-xs text-slate-500">
            설정이 완료되면 이 창을 닫고 Client ID와 Secret을 입력란에 붙여넣으세요.
          </p>
          <a
            className="shrink-0 rounded-full bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-slate-700 transition"
            href={guide.consoleUrl}
            rel="noopener noreferrer"
            target="_blank"
          >
            {guide.icon} {guide.label} 콘솔 열기 ↗
          </a>
        </div>
      </div>
    </div>
  );
}
