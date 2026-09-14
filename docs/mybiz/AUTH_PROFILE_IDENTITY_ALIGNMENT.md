---
type: identity-alignment
project: MyBiz
status: activation-blocked
updated: 2026-09-14
tags: [mybiz, service-os, auth, rls, supabase]
---

# Auth / Profile Identity Alignment

## Sanitized Production metadata

Target: `Mybiz Project` / `plnuyudyogbzwpmdulnw` / `ap-northeast-2`.

```text
profiles_count=3
auth_users_count=3
store_members_count=7

profiles_without_matching_auth_user=1
auth_users_without_matching_profile=1
store_members_without_profile=0
store_members_with_profile_auth_match=1

PROFILE_AUTH_FK_EXISTS=false
AUTH_USER_MAPPING_COLUMN=ABSENT
PROFILE_AUTH_EQUALITY_UNIVERSAL=false
```

개별 UUID, email, phone, token, session, credential은 조회하거나 기록하지 않았다.

## Existing membership predicate

현재 `public.is_store_member(target_store_id uuid)`는 `SECURITY DEFINER`, `STABLE`,
`search_path=public`이며 다음 predicate를 사용한다.

```sql
store_members.store_id = target_store_id
and store_members.profile_id = auth.uid()
```

이 함수는 변경하지 않는다. 현재 일부 row에서만 profile/auth ID가 일치하므로 이
predicate가 universal identity mapping을 증명하지는 않는다.

## Foundation actor reference domain

```text
service_jobs.created_by=PROFILE_ID
job_evidence_revisions.created_by=PROFILE_ID
job_evidence_assets.uploader_user_id=PROFILE_ID
```

Foundation은 authenticated write를 허용하지 않으므로 위 FK는 business actor
reference로만 유지된다. `service_role` 사용도 authorization 결정을 대신하지 않는다.

## Activation hold

```text
LIVE_WRITE_ACTIVATION_READY=false
LIVE_WRITE_ACTIVATION_STATUS=BLOCKED_AUTH_IDENTITY_MODEL
```

향후 activation에는 authenticated user → approved actor/profile mapping → store
membership → requested resource ownership을 검증하는 별도 server adapter와 Owner
Gate가 필요하다. 현재 activation draft는 `profiles.id → auth.users.id` FK가 없으면
fail-closed한다.
