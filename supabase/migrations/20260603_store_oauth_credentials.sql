-- store_oauth_credentials
-- 점주가 대시보드에서 직접 입력한 소셜 플랫폼 OAuth 자격증명을 저장합니다.
-- client_id / client_secret 은 서버에서 TOKEN_ENCRYPTION_KEY 로 암호화한 뒤 저장합니다.
-- OAuth 흐름 시작 시 이 테이블을 우선 조회하고, 없으면 환경 변수를 폴백으로 사용합니다.

create table if not exists store_oauth_credentials (
  id            uuid primary key default gen_random_uuid(),
  store_id      text not null,
  provider      text not null,  -- 'threads' | 'naver_blog' | 'youtube' | 'kakao_share'
  client_id     text,           -- 암호화된 값
  client_secret text,           -- 암호화된 값
  redirect_uri  text,           -- 예: https://mybiz.ai.kr/api/auth/threads/callback
  extra_config  jsonb default '{}',  -- 추가 설정 (예: kakao template_id)
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (store_id, provider)
);

-- RLS: store_id 가 현재 사용자의 store 와 일치할 때만 읽기/쓰기 허용
alter table store_oauth_credentials enable row level security;

-- 서비스 롤(서버)은 전체 접근
create policy "service role full access" on store_oauth_credentials
  for all using (true)
  with check (true);

-- 업데이트 시 updated_at 자동 갱신
create or replace function update_store_oauth_credentials_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_store_oauth_credentials_updated_at on store_oauth_credentials;
create trigger trg_store_oauth_credentials_updated_at
  before update on store_oauth_credentials
  for each row execute function update_store_oauth_credentials_updated_at();
