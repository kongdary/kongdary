create table if not exists public.contact_requests (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text not null check (char_length(name) between 1 and 80),
  email text not null check (char_length(email) between 3 and 254),
  topic text not null default '이야기',
  message text not null check (char_length(message) between 1 and 4000),
  consented_at timestamptz not null,
  status text not null default 'new'
);

alter table public.contact_requests enable row level security;

-- 공개 역할에는 읽기·쓰기 권한을 주지 않습니다.
-- Vercel 서버에서만 service_role 키로 접수 내용을 처리합니다.
create index if not exists contact_requests_created_at_idx on public.contact_requests (created_at);
