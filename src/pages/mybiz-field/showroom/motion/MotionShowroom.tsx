import { useEffect, useRef, useState } from 'react';
import { MOTION_CATALOG, type MotionCatalogItem } from './motionRegistry';
import { mountMotionStage } from './motionRuntime';
import './motionShowroom.css';

function LiveMotion({ item }: { item: MotionCatalogItem }) {
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!host.current) return;
    return mountMotionStage(host.current, item.kind);
  }, [item.kind]);
  return <div aria-label={`${item.name} 실제 동작 체험`} ref={host} />;
}

function MotionCard({ item, index, selected, onSelect }: { item: MotionCatalogItem; index: number; selected: boolean; onSelect: (id: string) => void }) {
  const [videoVisible, setVideoVisible] = useState(false);
  const [videoFailed, setVideoFailed] = useState(false);
  return (
    <article className="mf-card" data-selected={selected} data-motion-card={item.id}>
      <LiveMotion item={item} />
      <div className="mf-card-body">
        <div className="mf-card-title"><h3>{item.name}</h3><span className="mf-card-number">{String(index + 1).padStart(2, '0')} / 03</span></div>
        <p className="mf-card-copy">{item.description}</p>
        <div className="mf-tags">{item.useCases.map((useCase) => <span key={useCase}>{useCase}</span>)}</div>
        <p className="mf-selection-label">{item.priceLabel}</p>
        <div className="mf-actions"><button aria-pressed={selected} className="mf-action" onClick={() => onSelect(item.id)} type="button">{selected ? '상담 요청서에 선택됨 ✓' : '이 모션으로 홈페이지 상담 ↗'}</button></div>
        <div className="mf-media">
          <button aria-expanded={videoVisible} className="mf-media-toggle" onClick={() => setVideoVisible((value) => !value)} type="button">{videoVisible ? '촬영 영상 닫기' : '실제 코드 촬영 영상 보기'}</button>
          {videoVisible ? videoFailed ? <><img alt={`${item.name} 코드 실행 화면`} className="mf-poster" height="450" loading="lazy" src={item.poster} width="600" /><p className="mf-card-copy">영상을 재생할 수 없습니다. 위의 실제 데모를 이용해 주세요.</p></> : <video aria-label={`${item.name} 코드 실행 무음 영상`} className="mf-video" controls onError={() => setVideoFailed(true)} playsInline poster={item.poster} preload="none" src={item.video} /> : null}
        </div>
      </div>
    </article>
  );
}

export function MotionShowroom({ selectedMotionId, onSelect }: { selectedMotionId?: string; onSelect: (id: string | undefined) => void }) {
  const selected = MOTION_CATALOG.find((item) => item.id === selectedMotionId);
  return (
    <section aria-labelledby="motion-showroom-heading" className="mf-showroom" data-motion-showroom="pilot" id="motion-showroom">
      <div className="mf-inner">
        <div className="mf-intro"><div><p className="mf-eyebrow">MYBIZLAB / HOMEPAGE + MOTION</p><h2 id="motion-showroom-heading">보는 홈페이지에서,<br />경험하는 홈페이지로.</h2></div><p>먼저 직접 움직여 보세요.<br />마음에 드는 모션을 고르면, 작성 중인 개발 상담 요청서에 함께 담깁니다.</p></div>
        <div className="mf-grid">{MOTION_CATALOG.map((item, index) => <MotionCard index={index} item={item} key={item.id} onSelect={onSelect} selected={item.id === selectedMotionId} />)}</div>
        <div className="mf-summary" role="status"><div><strong>{selected ? `선택한 모션: ${selected.name}` : '홈페이지 구축에 필요한 스타일을 함께 정합니다.'}</strong><p>모션 적용, 맞춤 페이지 구성, 기존 시스템 연결 범위를 상담합니다. 현재 선택만으로 결제되거나 접수되지 않습니다.</p></div><div className="mf-summary-actions"><a className="mf-action" href="#project-request">개발 상담 요청서 작성 ↗</a>{selected ? <button className="mf-action mf-action--secondary" onClick={() => onSelect(undefined)} type="button">선택 지우기</button> : null}</div></div>
        <p className="mf-note">자체 제작 코드로 구동하는 파일럿 쇼룸입니다. 완성 사이트 납품·별도 코드 라이선스·유지보수 범위는 상담 후 확정합니다. 실제 수신은 메일 발송 이후 별도로 확인합니다.</p>
      </div>
    </section>
  );
}
