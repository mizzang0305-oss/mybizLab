# Live Canonical Alignment Runbook

Date: 2026-04-24  
Scope: `store_subscriptions` canonical alignment, `MyBiz Live Cafe` public text backfill  
Out of scope: PortOne console work, sandbox paid completion, webhook secret alignment

## 1. Why This Runbook Exists

The application now reads entitlement truth through a single canonical-first path. If live Supabase still lacks `public.store_subscriptions`, the UI will explicitly show a degraded canonical warning instead of pretending the plan is GREEN.

This runbook closes that gap on the database side.

## 2. Preconditions

- Open the linked live Supabase project in SQL Editor
- Confirm the target store exists:

```sql
select
  coalesce(to_jsonb(s) ->> 'store_id', to_jsonb(s) ->> 'id') as store_pk,
  to_jsonb(s) ->> 'slug' as slug,
  to_jsonb(s) ->> 'name' as name
from public.stores s
where coalesce(to_jsonb(s) ->> 'slug', '') = 'mybiz-live-cafe'
   or coalesce(to_jsonb(s) ->> 'store_id', to_jsonb(s) ->> 'id', '') = '20d95f47-bae6-43a2-a9c9-a190be176747';
```

- Confirm whether legacy subscriptions still exist:

```sql
select to_regclass('public.subscriptions') as legacy_subscriptions_table;
select to_regclass('public.store_subscriptions') as canonical_store_subscriptions_table;
```

## 3. Step Order

1. Run [20260424_store_subscriptions_canonical_alignment.sql](/C:/Users/LOVE/MyProjects/mybizLab/supabase/migrations/20260424_store_subscriptions_canonical_alignment.sql)
2. Validate canonical subscription rows
3. Run [20260424_public_store_text_backfill.sql](/C:/Users/LOVE/MyProjects/mybizLab/supabase/migrations/20260424_public_store_text_backfill.sql)
4. Validate public text before leaving SQL Editor

## 4. Validation Queries

### Canonical subscription truth

```sql
select
  ss.store_id,
  to_jsonb(s) ->> 'slug' as slug,
  to_jsonb(s) ->> 'name' as name,
  ss.plan,
  ss.status,
  ss.billing_provider,
  ss.updated_at
from public.store_subscriptions ss
join public.stores s
  on (
    case
      when nullif(to_jsonb(s) ->> 'store_id', '') is not null then (to_jsonb(s) ->> 'store_id')::uuid
      when nullif(to_jsonb(s) ->> 'id', '') is not null then (to_jsonb(s) ->> 'id')::uuid
      else null
    end
  ) = ss.store_id
where coalesce(to_jsonb(s) ->> 'slug', '') = 'mybiz-live-cafe'
order by ss.updated_at desc;
```

### Drift check between legacy and canonical

```sql
with legacy as (
  select
    sm.store_id,
    max(coalesce(sub.updated_at, sub.started_at)) as legacy_updated_at
  from public.store_members sm
  join public.subscriptions sub on sub.user_id = sm.profile_id
  group by sm.store_id
)
select
  to_jsonb(s) ->> 'slug' as slug,
  ss.plan as canonical_plan,
  ss.status as canonical_status,
  ss.updated_at as canonical_updated_at,
  legacy.legacy_updated_at
from public.stores s
left join public.store_subscriptions ss
  on ss.store_id = (
    case
      when nullif(to_jsonb(s) ->> 'store_id', '') is not null then (to_jsonb(s) ->> 'store_id')::uuid
      when nullif(to_jsonb(s) ->> 'id', '') is not null then (to_jsonb(s) ->> 'id')::uuid
      else null
    end
  )
left join legacy
  on legacy.store_id = (
    case
      when nullif(to_jsonb(s) ->> 'store_id', '') is not null then (to_jsonb(s) ->> 'store_id')::uuid
      when nullif(to_jsonb(s) ->> 'id', '') is not null then (to_jsonb(s) ->> 'id')::uuid
      else null
    end
  )
where coalesce(to_jsonb(s) ->> 'slug', '') = 'mybiz-live-cafe';
```

### Public storefront copy

```sql
select
  to_jsonb(s) ->> 'slug' as slug,
  s.tagline as store_tagline,
  s.description as store_description,
  p.tagline as page_tagline,
  p.description as page_description,
  p.hero_title,
  p.hero_subtitle,
  p.hero_description,
  p.primary_cta_label,
  p.mobile_cta_label,
  p.seo_metadata
from public.stores s
left join public.store_public_pages p
  on p.store_id = (
    case
      when nullif(to_jsonb(s) ->> 'store_id', '') is not null then (to_jsonb(s) ->> 'store_id')::uuid
      when nullif(to_jsonb(s) ->> 'id', '') is not null then (to_jsonb(s) ->> 'id')::uuid
      else null
    end
  )
where coalesce(to_jsonb(s) ->> 'slug', '') = 'mybiz-live-cafe';
```

## 5. Expected Result In App

- `/dashboard/billing`, `/dashboard`, `/dashboard/system`
  - canonical degraded warning disappears once `store_subscriptions` exists and the row is present
- `/mybiz-live-cafe`
  - no broken `???`, placeholder, or internal-looking fallback copy
  - store header reads like a real storefront

## 6. Rollback

If the text backfill produced an unwanted result, restore the single target store row from backup or manually overwrite only the affected fields in:

- `public.stores`
- `public.store_public_pages`
- `public.store_brand_profiles` if present

For subscriptions, safest rollback is to revert only the affected `store_subscriptions` rows rather than dropping the table.
