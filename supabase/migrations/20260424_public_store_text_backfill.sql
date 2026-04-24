do $$
declare
  target_store_id uuid;
  target_store_name text;
begin
  select
    case
      when nullif(to_jsonb(s) ->> 'store_id', '') is not null then (to_jsonb(s) ->> 'store_id')::uuid
      when nullif(to_jsonb(s) ->> 'id', '') is not null then (to_jsonb(s) ->> 'id')::uuid
      else null
    end,
    coalesce(nullif(trim(to_jsonb(s) ->> 'name'), ''), 'MyBiz Live Cafe')
  into target_store_id, target_store_name
  from public.stores s
  where coalesce(to_jsonb(s) ->> 'slug', '') = 'mybiz-live-cafe'
     or coalesce(to_jsonb(s) ->> 'store_id', to_jsonb(s) ->> 'id', '') = '20d95f47-bae6-43a2-a9c9-a190be176747'
  limit 1;

  if target_store_id is null then
    raise notice 'Skipping public store text backfill because MyBiz Live Cafe was not found.';
    return;
  end if;

  update public.stores s
  set
    tagline = case
      when trim(coalesce(s.tagline, '')) = ''
        or s.tagline ~ '\?{2,}'
        or lower(s.tagline) in ('demo', 'test', 'sample', 'placeholder')
        or s.tagline ilike '%운영 스토어%'
      then format('%s의 메뉴와 방문 안내를 먼저 확인해 보세요.', target_store_name)
      else s.tagline
    end,
    description = case
      when trim(coalesce(s.description, '')) = ''
        or s.description ~ '\?{2,}'
        or lower(s.description) in ('demo', 'test', 'sample', 'placeholder')
        or s.description ilike '%운영 데이터를 확인하는 스토어%'
      then format('%s의 메뉴, 문의, 예약, 웨이팅, 주문 안내를 한 번에 확인할 수 있습니다.', target_store_name)
      else s.description
    end,
    updated_at = timezone('utc', now())
  where (
    case
      when nullif(to_jsonb(s) ->> 'store_id', '') is not null then (to_jsonb(s) ->> 'store_id')::uuid
      when nullif(to_jsonb(s) ->> 'id', '') is not null then (to_jsonb(s) ->> 'id')::uuid
      else null
    end
  ) = target_store_id;

  update public.store_public_pages p
  set
    brand_name = case
      when trim(coalesce(p.brand_name, '')) = ''
        or p.brand_name ~ '\?{2,}'
        or lower(p.brand_name) in ('demo', 'test', 'sample', 'placeholder')
      then target_store_name
      else p.brand_name
    end,
    tagline = case
      when trim(coalesce(p.tagline, '')) = ''
        or p.tagline ~ '\?{2,}'
        or lower(p.tagline) in ('demo', 'test', 'sample', 'placeholder')
        or p.tagline ilike '%운영 스토어%'
      then format('%s의 메뉴와 방문 안내를 먼저 확인해 보세요.', target_store_name)
      else p.tagline
    end,
    description = case
      when trim(coalesce(p.description, '')) = ''
        or p.description ~ '\?{2,}'
        or lower(p.description) in ('demo', 'test', 'sample', 'placeholder')
        or p.description ilike '%운영 데이터를 확인하는 스토어%'
      then format('%s의 메뉴, 문의, 예약, 웨이팅, 주문 안내를 한 번에 확인할 수 있습니다.', target_store_name)
      else p.description
    end,
    hero_title = case
      when trim(coalesce(p.hero_title, '')) = ''
        or p.hero_title ~ '\?{2,}'
        or lower(p.hero_title) in ('demo', 'test', 'sample', 'placeholder')
      then target_store_name
      else p.hero_title
    end,
    hero_subtitle = case
      when trim(coalesce(p.hero_subtitle, '')) = ''
        or p.hero_subtitle ~ '\?{2,}'
        or lower(p.hero_subtitle) in ('demo', 'test', 'sample', 'placeholder')
        or p.hero_subtitle ilike '%운영 스토어%'
      then format('%s의 대표 메뉴와 방문 안내를 먼저 확인해 보세요.', target_store_name)
      else p.hero_subtitle
    end,
    hero_description = case
      when trim(coalesce(p.hero_description, '')) = ''
        or p.hero_description ~ '\?{2,}'
        or lower(p.hero_description) in ('demo', 'test', 'sample', 'placeholder')
        or p.hero_description ilike '%운영 데이터를 확인하는 스토어%'
      then format('%s 방문 전에 필요한 메뉴와 안내, 문의·예약·웨이팅·주문 시작 화면을 한 곳에서 확인할 수 있습니다.', target_store_name)
      else p.hero_description
    end,
    primary_cta_label = case
      when trim(coalesce(p.primary_cta_label, '')) = ''
        or p.primary_cta_label ~ '\?{2,}'
        or lower(p.primary_cta_label) in ('demo', 'test', 'sample', 'placeholder')
      then '메뉴 보기'
      else p.primary_cta_label
    end,
    mobile_cta_label = case
      when trim(coalesce(p.mobile_cta_label, '')) = ''
        or p.mobile_cta_label ~ '\?{2,}'
        or lower(p.mobile_cta_label) in ('demo', 'test', 'sample', 'placeholder')
      then '바로 보기'
      else p.mobile_cta_label
    end,
    seo_metadata = coalesce(p.seo_metadata, '{}'::jsonb)
      || jsonb_build_object(
        'title',
        case
          when trim(coalesce(p.seo_metadata ->> 'title', '')) = ''
            or coalesce(p.seo_metadata ->> 'title', '') ~ '\?{2,}'
            or lower(coalesce(p.seo_metadata ->> 'title', '')) in ('demo', 'test', 'sample', 'placeholder')
          then format('%s 공개 스토어', target_store_name)
          else p.seo_metadata ->> 'title'
        end,
        'description',
        case
          when trim(coalesce(p.seo_metadata ->> 'description', '')) = ''
            or coalesce(p.seo_metadata ->> 'description', '') ~ '\?{2,}'
            or lower(coalesce(p.seo_metadata ->> 'description', '')) in ('demo', 'test', 'sample', 'placeholder')
          then format('%s의 메뉴와 방문 안내를 확인할 수 있는 공개 매장 페이지입니다.', target_store_name)
          else p.seo_metadata ->> 'description'
        end
      ),
    media = case
      when jsonb_typeof(coalesce(p.media, '[]'::jsonb)) = 'array' then (
        select coalesce(
          jsonb_agg(
            jsonb_set(
              jsonb_set(
                media_item,
                '{title}',
                to_jsonb(
                  case
                    when trim(coalesce(media_item ->> 'title', '')) = ''
                      or coalesce(media_item ->> 'title', '') ~ '\?{2,}'
                      or lower(coalesce(media_item ->> 'title', '')) in ('demo', 'test', 'sample', 'placeholder')
                    then case coalesce(media_item ->> 'type', '')
                      when 'hero' then '대표 이미지'
                      when 'storefront' then '매장 전경'
                      when 'interior' then '매장 내부'
                      else '매장 이미지'
                    end
                    else media_item ->> 'title'
                  end
                ),
                true
              ),
              '{caption}',
              to_jsonb(
                case
                  when trim(coalesce(media_item ->> 'caption', '')) = ''
                    or coalesce(media_item ->> 'caption', '') ~ '\?{2,}'
                    or lower(coalesce(media_item ->> 'caption', '')) in ('demo', 'test', 'sample', 'placeholder')
                  then format(
                    '%s %s',
                    target_store_name,
                    case coalesce(media_item ->> 'type', '')
                      when 'hero' then '대표 이미지'
                      when 'storefront' then '매장 전경'
                      when 'interior' then '매장 내부'
                      else '매장 이미지'
                    end
                  )
                  else media_item ->> 'caption'
                end
              ),
              true
            )
          ),
          '[]'::jsonb
        )
        from jsonb_array_elements(coalesce(p.media, '[]'::jsonb)) as media_item
      )
      else p.media
    end,
    notices = case
      when jsonb_typeof(coalesce(p.notices, '[]'::jsonb)) = 'array' then (
        select coalesce(
          jsonb_agg(
            jsonb_set(
              jsonb_set(
                notice_item,
                '{title}',
                to_jsonb(
                  case
                    when trim(coalesce(notice_item ->> 'title', '')) = ''
                      or coalesce(notice_item ->> 'title', '') ~ '\?{2,}'
                      or lower(coalesce(notice_item ->> 'title', '')) in ('demo', 'test', 'sample', 'placeholder')
                    then '매장 안내'
                    else notice_item ->> 'title'
                  end
                ),
                true
              ),
              '{content}',
              to_jsonb(
                case
                  when trim(coalesce(notice_item ->> 'content', '')) = ''
                    or coalesce(notice_item ->> 'content', '') ~ '\?{2,}'
                    or lower(coalesce(notice_item ->> 'content', '')) in ('demo', 'test', 'sample', 'placeholder')
                  then format('%s 방문 전에 필요한 안내를 공지에서 확인해 주세요.', target_store_name)
                  else notice_item ->> 'content'
                end
              ),
              true
            )
          ),
          '[]'::jsonb
        )
        from jsonb_array_elements(coalesce(p.notices, '[]'::jsonb)) as notice_item
      )
      else p.notices
    end,
    updated_at = timezone('utc', now())
  where p.store_id = target_store_id;

  if to_regclass('public.store_brand_profiles') is not null then
    update public.store_brand_profiles b
    set
      brand_name = case
        when trim(coalesce(b.brand_name, '')) = ''
          or b.brand_name ~ '\?{2,}'
          or lower(b.brand_name) in ('demo', 'test', 'sample', 'placeholder')
        then target_store_name
        else b.brand_name
      end,
      tagline = case
        when trim(coalesce(b.tagline, '')) = ''
          or b.tagline ~ '\?{2,}'
          or lower(b.tagline) in ('demo', 'test', 'sample', 'placeholder')
          or b.tagline ilike '%운영 스토어%'
        then format('%s의 메뉴와 방문 안내를 먼저 확인해 보세요.', target_store_name)
        else b.tagline
      end,
      description = case
        when trim(coalesce(b.description, '')) = ''
          or b.description ~ '\?{2,}'
          or lower(b.description) in ('demo', 'test', 'sample', 'placeholder')
          or b.description ilike '%운영 데이터를 확인하는 스토어%'
        then format('%s의 메뉴, 문의, 예약, 웨이팅, 주문 안내를 한 번에 확인할 수 있습니다.', target_store_name)
        else b.description
      end,
      updated_at = timezone('utc', now())
    where b.store_id = target_store_id;
  end if;
end;
$$;
