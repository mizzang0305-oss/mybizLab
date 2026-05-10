import { useMemo, useState } from 'react';

import {
  buildKakaoSharePayload,
  getKakaoSdkUrl,
  getKakaoShareReadiness,
  recordKakaoShareEvent,
  type KakaoShareEnv,
  type KakaoShareInput,
} from '@/shared/lib/kakaoShare';

type KakaoSdk = {
  init: (javascriptKey: string) => void;
  isInitialized: () => boolean;
  Share: {
    sendDefault: (payload: unknown) => void;
  };
};

const KAKAO_SHARE_POLICY_COPY = '카카오 공유는 사용자가 직접 공유하는 방식으로 제공됩니다.';

declare global {
  interface Window {
    Kakao?: KakaoSdk;
  }
}

export interface KakaoShareButtonProps extends KakaoShareInput {
  className?: string;
  env?: KakaoShareEnv;
  label?: string;
}

let kakaoSdkPromise: Promise<KakaoSdk> | null = null;

function loadKakaoSdk(javascriptKey: string) {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return Promise.reject(new Error('Kakao SDK는 브라우저에서만 사용할 수 있습니다.'));
  }

  if (window.Kakao) {
    if (!window.Kakao.isInitialized()) {
      window.Kakao.init(javascriptKey);
    }
    return Promise.resolve(window.Kakao);
  }

  if (!kakaoSdkPromise) {
    kakaoSdkPromise = new Promise<KakaoSdk>((resolve, reject) => {
      const script = document.createElement('script');
      script.async = true;
      script.src = getKakaoSdkUrl();
      script.onload = () => {
        if (!window.Kakao) {
          reject(new Error('Kakao SDK를 불러오지 못했습니다.'));
          return;
        }

        if (!window.Kakao.isInitialized()) {
          window.Kakao.init(javascriptKey);
        }
        resolve(window.Kakao);
      };
      script.onerror = () => reject(new Error('Kakao SDK를 불러오지 못했습니다.'));
      document.head.appendChild(script);
    });
  }

  return kakaoSdkPromise;
}

export function KakaoShareButton({
  className,
  description,
  env,
  imageUrl,
  label = '카카오톡 공유',
  reviewStatus,
  sourceId,
  sourceType,
  title,
  webUrl,
}: KakaoShareButtonProps) {
  const [message, setMessage] = useState<string | null>(null);
  const [isSharing, setIsSharing] = useState(false);
  const readiness = useMemo(() => getKakaoShareReadiness(env), [env]);
  const payloadInput = useMemo(
    () => ({
      description,
      imageUrl,
      reviewStatus,
      sourceId,
      sourceType,
      title,
      webUrl,
    }),
    [description, imageUrl, reviewStatus, sourceId, sourceType, title, webUrl],
  );
  const payloadResult = useMemo(() => buildKakaoSharePayload(payloadInput), [payloadInput]);
  const disabled = isSharing || !readiness.ready || !payloadResult.shareable;
  const disabledReason = !readiness.ready
    ? `설정 대기: ${readiness.missingEnvNames.join(', ')}`
    : payloadResult.shareable
      ? KAKAO_SHARE_POLICY_COPY
      : payloadResult.message;

  const handleShare = async () => {
    if (disabled || !payloadResult.shareable || !readiness.javascriptKey) {
      return;
    }

    setIsSharing(true);
    setMessage(null);

    try {
      const kakao = await loadKakaoSdk(readiness.javascriptKey);
      kakao.Share.sendDefault(payloadResult.payload);
      recordKakaoShareEvent({
        sourceId: payloadInput.sourceId,
        sourceType: payloadInput.sourceType,
        status: 'share_started',
      });
      setMessage('카카오톡 공유 창을 열었습니다. 전송 여부는 사용자가 카카오톡에서 직접 결정합니다.');
    } catch (error) {
      recordKakaoShareEvent({
        errorMessage: error instanceof Error ? error.message : 'Kakao SDK share failed.',
        sourceId: payloadInput.sourceId,
        sourceType: payloadInput.sourceType,
        status: 'failed',
      });
      setMessage('카카오 공유를 시작하지 못했습니다. 잠시 후 다시 시도해 주세요.');
    } finally {
      setIsSharing(false);
    }
  };

  return (
    <div className="space-y-2" data-kakao-share-source={payloadInput.sourceType}>
      <button
        className={className || 'btn-secondary justify-center'}
        disabled={disabled}
        onClick={() => void handleShare()}
        title={disabledReason}
        type="button"
      >
        {isSharing ? '공유 준비 중' : label}
      </button>
      <div className="space-y-1 text-xs font-semibold leading-5 text-slate-500">
        <p>{KAKAO_SHARE_POLICY_COPY}</p>
        {(message || disabledReason) ? <p>{message || disabledReason}</p> : null}
      </div>
    </div>
  );
}
