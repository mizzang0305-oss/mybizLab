do $$
declare
  target_store_id uuid;
  target_store_name text;
  broken_store_pattern text := '%운영 스토어%';
  broken_description_pattern text := '%운영 데이터를 확인하는 스토어%';
  store_tagline_fallback text;
  store_description_fallback text;
  hero_subtitle_fallback text;
  hero_description_fallback text;
  seo_title_fallback text;
  seo_description_fallback text;
  notice_content_fallback text;
  store_assignments text[] := array[]::text[];
  page_assignments text[] := array[]::text[];
  brand_assignments text[] := array[]::text[];
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

  store_tagline_fallback := format('%s의 메뉴와 방문 안내를 먼저 확인해 보세요.', target_store_name);
  store_description_fallback := format('%s의 메뉴, 문의, 예약, 웨이팅, 주문 안내를 한 번에 확인할 수 있습니다.', target_store_name);
  hero_subtitle_fallback := format('%s의 대표 메뉴와 방문 안내를 먼저 확인해 보세요.', target_store_name);
  hero_description_fallback := format(
    '%s 방문 전에 필요한 메뉴와 안내, 문의·예약·웨이팅·주문 시작 화면을 한 곳에서 확인할 수 있습니다.',
    target_store_name
  );
  seo_title_fallback := format('%s 공개 스토어', target_store_name);
  seo_description_fallback := format('%s의 메뉴와 방문 안내를 확인할 수 있는 공개 매장 페이지입니다.', target_store_name);
  notice_content_fallback := format('%s 방문 전에 필요한 안내를 공지에서 확인해 주세요.', target_store_name);

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'stores'
      and column_name = 'tagline'
  ) then
    store_assignments := array_append(store_assignments, format(
      $sql$tagline = case
        when trim(coalesce(tagline, '')) = ''
          or tagline ~ '\?{2,}'
          or lower(tagline) in ('demo', 'test', 'sample', 'placeholder')
          or tagline ilike %L
        then %L
        else tagline
      end$sql$,
      broken_store_pattern,
      store_tagline_fallback
    ));
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'stores'
      and column_name = 'description'
  ) then
    store_assignments := array_append(store_assignments, format(
      $sql$description = case
        when trim(coalesce(description, '')) = ''
          or description ~ '\?{2,}'
          or lower(description) in ('demo', 'test', 'sample', 'placeholder')
          or description ilike %L
        then %L
        else description
      end$sql$,
      broken_description_pattern,
      store_description_fallback
    ));
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'stores'
      and column_name = 'updated_at'
  ) then
    store_assignments := array_append(store_assignments, 'updated_at = timezone(''utc'', now())');
  end if;

  if coalesce(array_length(store_assignments, 1), 0) > 0 then
    execute format(
      $sql$
      update public.stores s
      set %s
      where (
        case
          when nullif(to_jsonb(s) ->> 'store_id', '') is not null then (to_jsonb(s) ->> 'store_id')::uuid
          when nullif(to_jsonb(s) ->> 'id', '') is not null then (to_jsonb(s) ->> 'id')::uuid
          else null
        end
      ) = %L::uuid
      $sql$,
      array_to_string(store_assignments, ', '),
      target_store_id::text
    );
  end if;

  if to_regclass('public.store_public_pages') is not null then
    if exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'store_public_pages'
        and column_name = 'brand_name'
    ) then
      page_assignments := array_append(page_assignments, format(
        $sql$brand_name = case
          when trim(coalesce(brand_name, '')) = ''
            or brand_name ~ '\?{2,}'
            or lower(brand_name) in ('demo', 'test', 'sample', 'placeholder')
          then %L
          else brand_name
        end$sql$,
        target_store_name
      ));
    end if;

    if exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'store_public_pages'
        and column_name = 'tagline'
    ) then
      page_assignments := array_append(page_assignments, format(
        $sql$tagline = case
          when trim(coalesce(tagline, '')) = ''
            or tagline ~ '\?{2,}'
            or lower(tagline) in ('demo', 'test', 'sample', 'placeholder')
            or tagline ilike %L
          then %L
          else tagline
        end$sql$,
        broken_store_pattern,
        store_tagline_fallback
      ));
    end if;

    if exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'store_public_pages'
        and column_name = 'description'
    ) then
      page_assignments := array_append(page_assignments, format(
        $sql$description = case
          when trim(coalesce(description, '')) = ''
            or description ~ '\?{2,}'
            or lower(description) in ('demo', 'test', 'sample', 'placeholder')
            or description ilike %L
          then %L
          else description
        end$sql$,
        broken_description_pattern,
        store_description_fallback
      ));
    end if;

    if exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'store_public_pages'
        and column_name = 'hero_title'
    ) then
      page_assignments := array_append(page_assignments, format(
        $sql$hero_title = case
          when trim(coalesce(hero_title, '')) = ''
            or hero_title ~ '\?{2,}'
            or lower(hero_title) in ('demo', 'test', 'sample', 'placeholder')
          then %L
          else hero_title
        end$sql$,
        target_store_name
      ));
    end if;

    if exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'store_public_pages'
        and column_name = 'hero_subtitle'
    ) then
      page_assignments := array_append(page_assignments, format(
        $sql$hero_subtitle = case
          when trim(coalesce(hero_subtitle, '')) = ''
            or hero_subtitle ~ '\?{2,}'
            or lower(hero_subtitle) in ('demo', 'test', 'sample', 'placeholder')
            or hero_subtitle ilike %L
          then %L
          else hero_subtitle
        end$sql$,
        broken_store_pattern,
        hero_subtitle_fallback
      ));
    end if;

    if exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'store_public_pages'
        and column_name = 'hero_description'
    ) then
      page_assignments := array_append(page_assignments, format(
        $sql$hero_description = case
          when trim(coalesce(hero_description, '')) = ''
            or hero_description ~ '\?{2,}'
            or lower(hero_description) in ('demo', 'test', 'sample', 'placeholder')
            or hero_description ilike %L
          then %L
          else hero_description
        end$sql$,
        broken_description_pattern,
        hero_description_fallback
      ));
    end if;

    if exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'store_public_pages'
        and column_name = 'primary_cta_label'
    ) then
      page_assignments := array_append(page_assignments, $sql$primary_cta_label = case
        when trim(coalesce(primary_cta_label, '')) = ''
          or primary_cta_label ~ '\?{2,}'
          or lower(primary_cta_label) in ('demo', 'test', 'sample', 'placeholder')
        then '메뉴 보기'
        else primary_cta_label
      end$sql$);
    end if;

    if exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'store_public_pages'
        and column_name = 'mobile_cta_label'
    ) then
      page_assignments := array_append(page_assignments, $sql$mobile_cta_label = case
        when trim(coalesce(mobile_cta_label, '')) = ''
          or mobile_cta_label ~ '\?{2,}'
          or lower(mobile_cta_label) in ('demo', 'test', 'sample', 'placeholder')
        then '바로 보기'
        else mobile_cta_label
      end$sql$);
    end if;

    if exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'store_public_pages'
        and column_name = 'seo_metadata'
    ) then
      page_assignments := array_append(page_assignments, format(
        $sql$seo_metadata = coalesce(seo_metadata, '{}'::jsonb)
          || jsonb_build_object(
            'title',
            case
              when trim(coalesce(seo_metadata ->> 'title', '')) = ''
                or coalesce(seo_metadata ->> 'title', '') ~ '\?{2,}'
                or lower(coalesce(seo_metadata ->> 'title', '')) in ('demo', 'test', 'sample', 'placeholder')
              then %L
              else seo_metadata ->> 'title'
            end,
            'description',
            case
              when trim(coalesce(seo_metadata ->> 'description', '')) = ''
                or coalesce(seo_metadata ->> 'description', '') ~ '\?{2,}'
                or lower(coalesce(seo_metadata ->> 'description', '')) in ('demo', 'test', 'sample', 'placeholder')
              then %L
              else seo_metadata ->> 'description'
            end
          )$sql$,
        seo_title_fallback,
        seo_description_fallback
      ));
    end if;

    if exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'store_public_pages'
        and column_name = 'media'
    ) then
      page_assignments := array_append(page_assignments, format(
        $sql$media = case
          when jsonb_typeof(coalesce(media, '[]'::jsonb)) = 'array' then (
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
                      then %L || ' ' || case coalesce(media_item ->> 'type', '')
                        when 'hero' then '대표 이미지'
                        when 'storefront' then '매장 전경'
                        when 'interior' then '매장 내부'
                        else '매장 이미지'
                      end
                      else media_item ->> 'caption'
                    end
                  ),
                  true
                )
              ),
              '[]'::jsonb
            )
            from jsonb_array_elements(coalesce(media, '[]'::jsonb)) as media_item
          )
          else media
        end$sql$,
        target_store_name
      ));
    end if;

    if exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'store_public_pages'
        and column_name = 'notices'
    ) then
      page_assignments := array_append(page_assignments, format(
        $sql$notices = case
          when jsonb_typeof(coalesce(notices, '[]'::jsonb)) = 'array' then (
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
                      then %L
                      else notice_item ->> 'content'
                    end
                  ),
                  true
                )
              ),
              '[]'::jsonb
            )
            from jsonb_array_elements(coalesce(notices, '[]'::jsonb)) as notice_item
          )
          else notices
        end$sql$,
        notice_content_fallback
      ));
    end if;

    if exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'store_public_pages'
        and column_name = 'updated_at'
    ) then
      page_assignments := array_append(page_assignments, 'updated_at = timezone(''utc'', now())');
    end if;

    if coalesce(array_length(page_assignments, 1), 0) > 0 then
      execute format(
        $sql$
        update public.store_public_pages p
        set %s
        where coalesce(to_jsonb(p) ->> 'store_id', to_jsonb(p) ->> 'id', '') = %L
           or coalesce(to_jsonb(p) ->> 'slug', '') = 'mybiz-live-cafe'
        $sql$,
        array_to_string(page_assignments, ', '),
        target_store_id::text
      );
    end if;
  end if;

  if to_regclass('public.store_brand_profiles') is not null then
    if exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'store_brand_profiles'
        and column_name = 'brand_name'
    ) then
      brand_assignments := array_append(brand_assignments, format(
        $sql$brand_name = case
          when trim(coalesce(brand_name, '')) = ''
            or brand_name ~ '\?{2,}'
            or lower(brand_name) in ('demo', 'test', 'sample', 'placeholder')
          then %L
          else brand_name
        end$sql$,
        target_store_name
      ));
    end if;

    if exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'store_brand_profiles'
        and column_name = 'tagline'
    ) then
      brand_assignments := array_append(brand_assignments, format(
        $sql$tagline = case
          when trim(coalesce(tagline, '')) = ''
            or tagline ~ '\?{2,}'
            or lower(tagline) in ('demo', 'test', 'sample', 'placeholder')
            or tagline ilike %L
          then %L
          else tagline
        end$sql$,
        broken_store_pattern,
        store_tagline_fallback
      ));
    end if;

    if exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'store_brand_profiles'
        and column_name = 'description'
    ) then
      brand_assignments := array_append(brand_assignments, format(
        $sql$description = case
          when trim(coalesce(description, '')) = ''
            or description ~ '\?{2,}'
            or lower(description) in ('demo', 'test', 'sample', 'placeholder')
            or description ilike %L
          then %L
          else description
        end$sql$,
        broken_description_pattern,
        store_description_fallback
      ));
    end if;

    if exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'store_brand_profiles'
        and column_name = 'updated_at'
    ) then
      brand_assignments := array_append(brand_assignments, 'updated_at = timezone(''utc'', now())');
    end if;

    if coalesce(array_length(brand_assignments, 1), 0) > 0 then
      execute format(
        $sql$
        update public.store_brand_profiles b
        set %s
        where coalesce(to_jsonb(b) ->> 'store_id', to_jsonb(b) ->> 'id', '') = %L
        $sql$,
        array_to_string(brand_assignments, ', '),
        target_store_id::text
      );
    end if;
  end if;
end;
$$;
