-- Store branding v2: font_family column + expanded theme_preset options
-- Adds user-configurable font and two new theme presets (minimal, bold)

alter table stores
  add column if not exists font_family text
    check (font_family in ('pretendard', 'noto', 'inter'))
    default 'pretendard';

-- Relax existing theme_preset constraint to allow new presets
alter table stores
  drop constraint if exists stores_theme_preset_check;
alter table stores
  add constraint stores_theme_preset_check
    check (theme_preset in ('light', 'warm', 'modern', 'minimal', 'bold'));

-- Mirror on public_pages so the public layout can read it without joining
alter table public_pages
  add column if not exists font_family text
    check (font_family in ('pretendard', 'noto', 'inter'))
    default 'pretendard';

alter table public_pages
  drop constraint if exists public_pages_theme_preset_check;
alter table public_pages
  add constraint public_pages_theme_preset_check
    check (theme_preset in ('light', 'warm', 'modern', 'minimal', 'bold'));

-- store_requests: same expansion so onboarding flow stays consistent
alter table store_requests
  drop constraint if exists store_requests_theme_preset_check;
alter table store_requests
  add constraint store_requests_theme_preset_check
    check (theme_preset in ('light', 'warm', 'modern', 'minimal', 'bold'));
