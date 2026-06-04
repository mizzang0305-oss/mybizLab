/**
 * storeGalleryService.ts
 *
 * 매장 이미지 갤러리 — 업로드 / 조회 / 수정 / 삭제
 * Supabase Storage (store-gallery 버킷) + store_gallery_images 테이블 연동
 */
import { supabase } from '../../../integrations/supabase/client.js';

export type FrameStyle = 'none' | 'polaroid' | 'cafe' | 'retro' | 'modern' | 'neon';
export type DisplayType = 'gallery' | 'board' | 'feature';

export interface StoreGalleryImage {
  id: string;
  store_id: string;
  image_url: string;
  storage_path: string | null;
  title: string | null;
  caption: string | null;
  frame_style: FrameStyle;
  display_type: DisplayType;
  sort_order: number;
  is_public: boolean;
  created_at: string;
}

export interface UploadGalleryImageInput {
  file: File;
  title?: string;
  caption?: string;
  frameStyle?: FrameStyle;
  displayType?: DisplayType;
}

export interface UpdateGalleryImageInput {
  title?: string;
  caption?: string;
  frameStyle?: FrameStyle;
  displayType?: DisplayType;
  sortOrder?: number;
  isPublic?: boolean;
}

// ─── 이미지 목록 조회 ─────────────────────────────────────────────────────────

export async function listStoreGalleryImages(
  storeId: string,
  displayType?: DisplayType,
): Promise<StoreGalleryImage[]> {
  if (!supabase) return [];

  let query = supabase
    .from('store_gallery_images')
    .select('*')
    .eq('store_id', storeId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false });

  if (displayType) {
    query = query.eq('display_type', displayType);
  }

  const { data, error } = await query;
  if (error || !data) return [];
  return data as StoreGalleryImage[];
}

// ─── 공개용 이미지 목록 (public store page) ───────────────────────────────────

export async function listPublicStoreGalleryImages(
  storeId: string,
): Promise<StoreGalleryImage[]> {
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('store_gallery_images')
    .select('*')
    .eq('store_id', storeId)
    .eq('is_public', true)
    .order('sort_order', { ascending: true });

  if (error || !data) return [];
  return data as StoreGalleryImage[];
}

// ─── 이미지 업로드 ────────────────────────────────────────────────────────────

export async function uploadStoreGalleryImage(
  storeId: string,
  input: UploadGalleryImageInput,
): Promise<{ ok: boolean; image?: StoreGalleryImage; error?: string }> {
  if (!supabase) return { ok: false, error: 'Supabase 클라이언트가 없습니다.' };

  // 1. Storage에 업로드
  const ext = input.file.name.split('.').pop() || 'jpg';
  const storagePath = `${storeId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from('store-gallery')
    .upload(storagePath, input.file, { contentType: input.file.type, upsert: false });

  if (uploadError) return { ok: false, error: `업로드 실패: ${uploadError.message}` };

  // 2. Public URL 획득
  const { data: urlData } = supabase.storage
    .from('store-gallery')
    .getPublicUrl(storagePath);

  const imageUrl = urlData.publicUrl;

  // 3. DB에 기록
  const { data, error: dbError } = await supabase
    .from('store_gallery_images')
    .insert({
      store_id: storeId,
      image_url: imageUrl,
      storage_path: storagePath,
      title: input.title?.trim() || null,
      caption: input.caption?.trim() || null,
      frame_style: input.frameStyle || 'none',
      display_type: input.displayType || 'gallery',
      sort_order: 0,
      is_public: true,
    })
    .select('*')
    .single();

  if (dbError) return { ok: false, error: `DB 저장 실패: ${dbError.message}` };
  return { ok: true, image: data as StoreGalleryImage };
}

// ─── 이미지 수정 ─────────────────────────────────────────────────────────────

export async function updateStoreGalleryImage(
  id: string,
  input: UpdateGalleryImageInput,
): Promise<{ ok: boolean; error?: string }> {
  if (!supabase) return { ok: false, error: 'Supabase 클라이언트가 없습니다.' };

  const patch: Record<string, unknown> = {};
  if (input.title !== undefined) patch.title = input.title?.trim() || null;
  if (input.caption !== undefined) patch.caption = input.caption?.trim() || null;
  if (input.frameStyle !== undefined) patch.frame_style = input.frameStyle;
  if (input.displayType !== undefined) patch.display_type = input.displayType;
  if (input.sortOrder !== undefined) patch.sort_order = input.sortOrder;
  if (input.isPublic !== undefined) patch.is_public = input.isPublic;

  const { error } = await supabase.from('store_gallery_images').update(patch).eq('id', id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// ─── 이미지 삭제 ─────────────────────────────────────────────────────────────

export async function deleteStoreGalleryImage(
  id: string,
  storagePath: string | null,
): Promise<{ ok: boolean; error?: string }> {
  if (!supabase) return { ok: false, error: 'Supabase 클라이언트가 없습니다.' };

  // Storage 파일 삭제 (있을 때만)
  if (storagePath) {
    await supabase.storage.from('store-gallery').remove([storagePath]);
  }

  const { error } = await supabase.from('store_gallery_images').delete().eq('id', id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
