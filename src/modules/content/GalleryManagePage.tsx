/**
 * GalleryManagePage.tsx
 *
 * 대시보드 — 매장 이미지 갤러리 관리
 * - 드래그&드롭 또는 파일 선택으로 업로드
 * - 액자 스타일(frame_style) 선택
 * - 표시 유형(gallery / board / feature) 분류
 * - 제목/캡션 편집
 * - 삭제
 */
import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCurrentStore } from '@/shared/hooks/useCurrentStore';
import { usePageMeta } from '@/shared/hooks/usePageMeta';
import { PageHeader } from '@/shared/components/PageHeader';
import { Panel } from '@/shared/components/Panel';
import { EmptyState } from '@/shared/components/EmptyState';
import {
  type DisplayType,
  type FrameStyle,
  type StoreGalleryImage,
  deleteStoreGalleryImage,
  listStoreGalleryImages,
  updateStoreGalleryImage,
  uploadStoreGalleryImage,
} from '@/shared/lib/services/storeGalleryService';

// ─── 액자 스타일 정의 ─────────────────────────────────────────────────────────
export const FRAME_STYLES: Array<{ value: FrameStyle; label: string; preview: string }> = [
  { value: 'none',     label: '없음',     preview: 'bg-white border border-slate-200' },
  { value: 'polaroid', label: '폴라로이드', preview: 'bg-white border-4 border-white shadow-[0_4px_20px_rgba(0,0,0,0.18)] pb-8' },
  { value: 'cafe',     label: '카페',     preview: 'border-4 border-amber-800 shadow-[4px_4px_0_#7c2d12]' },
  { value: 'retro',    label: '레트로',   preview: 'border-4 border-yellow-400 shadow-[4px_4px_0_#ca8a04] sepia-[0.3]' },
  { value: 'modern',   label: '모던',     preview: 'border border-slate-900 shadow-[4px_4px_0_#0f172a]' },
  { value: 'neon',     label: '네온',     preview: 'border-2 border-[#ec5b13] shadow-[0_0_12px_#ec5b13]' },
];

const DISPLAY_TYPES: Array<{ value: DisplayType; label: string; icon: string; desc: string }> = [
  { value: 'gallery', label: '갤러리',   icon: '🖼️', desc: '매장 분위기 사진' },
  { value: 'board',   label: '이미지 게시판', icon: '📋', desc: '공지·메뉴·이벤트 포스터' },
  { value: 'feature', label: '대표 이미지', icon: '⭐', desc: '히어로 및 SNS 썸네일' },
];

// ─── 액자 CSS 적용 함수 ───────────────────────────────────────────────────────
export function getFrameClasses(style: FrameStyle): string {
  const map: Record<FrameStyle, string> = {
    none:     'rounded-2xl overflow-hidden',
    polaroid: 'bg-white p-2 pb-10 shadow-xl rounded-sm',
    cafe:     'border-4 border-amber-800 rounded-sm shadow-[4px_4px_0_#7c2d12]',
    retro:    'border-4 border-yellow-400 rounded-sm shadow-[4px_4px_0_#ca8a04]',
    modern:   'border border-slate-900 rounded-none shadow-[4px_4px_0_#0f172a]',
    neon:     'border-2 border-[#ec5b13] rounded-xl shadow-[0_0_16px_#ec5b13,0_0_32px_rgba(236,91,19,0.3)]',
  };
  return map[style] || map.none;
}

// ─── 이미지 카드 ──────────────────────────────────────────────────────────────
function GalleryCard({
  image,
  onDelete,
  onUpdate,
}: {
  image: StoreGalleryImage;
  onDelete: (id: string, storagePath: string | null) => void;
  onUpdate: (id: string, patch: { frameStyle?: FrameStyle; displayType?: DisplayType; title?: string; caption?: string }) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(image.title || '');
  const [caption, setCaption] = useState(image.caption || '');

  return (
    <div className="group relative rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden transition-shadow hover:shadow-md">
      {/* Image with frame */}
      <div className="relative overflow-hidden bg-slate-50">
        <div className={`${getFrameClasses(image.frame_style)} m-3`}>
          <img
            alt={image.title || '매장 이미지'}
            className="h-48 w-full object-cover"
            src={image.image_url}
          />
          {image.frame_style === 'polaroid' && (
            <p className="mt-1 text-center text-xs font-bold text-slate-600 truncate px-1">
              {image.title || ' '}
            </p>
          )}
        </div>
      </div>

      {/* Controls */}
      <div className="p-4 space-y-3">
        {/* Display type badge */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex flex-wrap gap-1.5">
            {DISPLAY_TYPES.map((dt) => (
              <button
                key={dt.value}
                className={`rounded-full px-2.5 py-0.5 text-xs font-bold transition-colors ${
                  image.display_type === dt.value
                    ? 'bg-orange-500 text-white'
                    : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                }`}
                onClick={() => onUpdate(image.id, { displayType: dt.value })}
                title={dt.desc}
                type="button"
              >
                {dt.icon} {dt.label}
              </button>
            ))}
          </div>
          <button
            className="rounded-full p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-500 transition-colors"
            onClick={() => onDelete(image.id, image.storage_path)}
            title="삭제"
            type="button"
          >
            🗑
          </button>
        </div>

        {/* Frame style picker */}
        <div>
          <p className="mb-1.5 text-[10px] font-black uppercase tracking-widest text-slate-400">액자 스타일</p>
          <div className="flex flex-wrap gap-1.5">
            {FRAME_STYLES.map((fs) => (
              <button
                key={fs.value}
                className={`rounded-full px-2.5 py-1 text-xs font-semibold transition-all ${
                  image.frame_style === fs.value
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
                onClick={() => onUpdate(image.id, { frameStyle: fs.value })}
                type="button"
              >
                {fs.label}
              </button>
            ))}
          </div>
        </div>

        {/* Title/caption edit */}
        {editing ? (
          <div className="space-y-2">
            <input
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              placeholder="제목"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <textarea
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              placeholder="설명"
              rows={2}
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
            />
            <div className="flex gap-2">
              <button
                className="btn-primary text-xs py-1.5"
                onClick={() => { onUpdate(image.id, { title, caption }); setEditing(false); }}
                type="button"
              >저장</button>
              <button className="btn-secondary text-xs py-1.5" onClick={() => setEditing(false)} type="button">취소</button>
            </div>
          </div>
        ) : (
          <button
            className="w-full rounded-xl border border-dashed border-slate-200 py-2 text-xs text-slate-400 hover:border-slate-300 hover:text-slate-600 transition-colors text-left px-3"
            onClick={() => setEditing(true)}
            type="button"
          >
            {image.title || '제목 추가'} {image.caption ? `— ${image.caption.slice(0, 20)}…` : ''}
            <span className="ml-1 text-slate-300">✏️</span>
          </button>
        )}
      </div>
    </div>
  );
}

// ─── 업로드 존 ────────────────────────────────────────────────────────────────
function UploadZone({ onFiles }: { onFiles: (files: FileList) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  return (
    <div
      className={`cursor-pointer rounded-3xl border-2 border-dashed p-8 text-center transition-all ${
        dragging ? 'border-orange-400 bg-orange-50' : 'border-slate-200 bg-slate-50 hover:border-orange-300 hover:bg-orange-50/50'
      }`}
      onClick={() => inputRef.current?.click()}
      onDragEnter={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => { e.preventDefault(); setDragging(false); if (e.dataTransfer.files.length) onFiles(e.dataTransfer.files); }}
    >
      <p className="text-3xl mb-3">📸</p>
      <p className="font-bold text-slate-700">클릭하거나 이미지를 끌어다 놓으세요</p>
      <p className="mt-1 text-xs text-slate-400">JPG, PNG, WebP · 최대 10MB · 여러 장 동시 업로드 가능</p>
      <input
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        multiple
        onChange={(e) => e.target.files && onFiles(e.target.files)}
        ref={inputRef}
        type="file"
      />
    </div>
  );
}

// ─── 메인 페이지 ──────────────────────────────────────────────────────────────
export function GalleryManagePage() {
  const { currentStore } = useCurrentStore();
  const queryClient = useQueryClient();
  const storeId = currentStore?.id || '';
  const [uploadProgress, setUploadProgress] = useState<string[]>([]);
  const [filter, setFilter] = useState<DisplayType | 'all'>('all');

  usePageMeta('이미지 갤러리', '매장 이미지와 게시판 사진을 관리합니다.');

  const imagesQuery = useQuery({
    queryKey: ['store-gallery', storeId],
    queryFn: () => listStoreGalleryImages(storeId),
    enabled: Boolean(storeId),
  });

  const deleteMutation = useMutation({
    mutationFn: ({ id, storagePath }: { id: string; storagePath: string | null }) =>
      deleteStoreGalleryImage(id, storagePath),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['store-gallery', storeId] }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Parameters<typeof updateStoreGalleryImage>[1] }) =>
      updateStoreGalleryImage(id, patch),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['store-gallery', storeId] }),
  });

  async function handleFiles(files: FileList) {
    const arr = Array.from(files);
    for (const file of arr) {
      setUploadProgress((p) => [...p, file.name]);
      await uploadStoreGalleryImage(storeId, { file });
      setUploadProgress((p) => p.filter((n) => n !== file.name));
    }
    void queryClient.invalidateQueries({ queryKey: ['store-gallery', storeId] });
  }

  const images = imagesQuery.data || [];
  const filtered = filter === 'all' ? images : images.filter((img) => img.display_type === filter);

  if (!currentStore) {
    return (
      <div className="p-8">
        <EmptyState title="매장을 먼저 선택해 주세요" description="갤러리 관리는 매장 단위로 이루어집니다." />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="콘텐츠"
        title="이미지 갤러리"
        description="매장 사진을 업로드하고 액자 스타일을 선택하면 공개 스토어 페이지에 바로 표시됩니다."
      />

      {/* 업로드 */}
      <Panel title="이미지 업로드" subtitle="한 번에 여러 장 업로드 가능합니다.">
        <UploadZone onFiles={handleFiles} />
        {uploadProgress.length > 0 && (
          <div className="mt-4 space-y-1.5">
            {uploadProgress.map((name) => (
              <div key={name} className="flex items-center gap-2 rounded-xl bg-orange-50 px-3 py-2 text-xs font-semibold text-orange-700">
                <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-orange-500 border-t-transparent" />
                {name} 업로드 중...
              </div>
            ))}
          </div>
        )}
      </Panel>

      {/* 이미지 목록 */}
      <Panel
        title={`이미지 목록 (${images.length}장)`}
        subtitle="액자 스타일과 표시 유형을 변경하면 즉시 적용됩니다."
      >
        {/* Filter tabs */}
        <div className="mb-5 flex flex-wrap gap-2">
          {([['all', '전체', '📁'], ...DISPLAY_TYPES.map((d) => [d.value, d.label, d.icon])] as [string, string, string][]).map(([val, label, icon]) => (
            <button
              key={val}
              className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-bold transition-all ${
                filter === val ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
              onClick={() => setFilter(val as DisplayType | 'all')}
              type="button"
            >
              {icon} {label}
              {val !== 'all' && (
                <span className="ml-0.5 text-xs opacity-60">
                  ({images.filter((img) => img.display_type === val).length})
                </span>
              )}
            </button>
          ))}
        </div>

        {imagesQuery.isLoading ? (
          <p className="text-sm text-slate-500">불러오는 중...</p>
        ) : filtered.length === 0 ? (
          <EmptyState title="이미지가 없습니다" description="위에서 사진을 업로드해 보세요." />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filtered.map((image) => (
              <GalleryCard
                key={image.id}
                image={image}
                onDelete={(id, sp) => deleteMutation.mutate({ id, storagePath: sp })}
                onUpdate={(id, patch) => updateMutation.mutate({
                  id,
                  patch: {
                    frameStyle: patch.frameStyle,
                    displayType: patch.displayType,
                    title: patch.title,
                    caption: patch.caption,
                  },
                })}
              />
            ))}
          </div>
        )}
      </Panel>

      {/* 미리보기 안내 */}
      <Panel title="공개 스토어 반영 안내" subtitle="이미지는 설정 즉시 공개 스토어에 표시됩니다.">
        <div className="grid gap-3 sm:grid-cols-3">
          {DISPLAY_TYPES.map((dt) => (
            <div key={dt.value} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
              <p className="text-2xl mb-2">{dt.icon}</p>
              <p className="font-bold text-slate-900">{dt.label}</p>
              <p className="mt-1 text-xs text-slate-500">{dt.desc}</p>
              <p className="mt-2 text-xs font-semibold text-orange-600">
                {images.filter((img) => img.display_type === dt.value).length}장 등록됨
              </p>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}
