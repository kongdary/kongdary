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

drop policy if exists "Anyone can submit a contact request" on public.contact_requests;
drop policy if exists "Kongdary admin can view requests" on public.contact_requests;
drop policy if exists "Kongdary admin can update requests" on public.contact_requests;
drop policy if exists "Kongdary admin can delete requests" on public.contact_requests;

create policy "Anyone can submit a contact request"
on public.contact_requests for insert to anon, authenticated
with check (true);

create policy "Kongdary admin can view requests"
on public.contact_requests for select to authenticated
using ((auth.jwt() ->> 'email') = 'agfe6981@gmail.com');

create policy "Kongdary admin can update requests"
on public.contact_requests for update to authenticated
using ((auth.jwt() ->> 'email') = 'agfe6981@gmail.com')
with check ((auth.jwt() ->> 'email') = 'agfe6981@gmail.com');

create policy "Kongdary admin can delete requests"
on public.contact_requests for delete to authenticated
using ((auth.jwt() ->> 'email') = 'agfe6981@gmail.com');

create index if not exists contact_requests_created_at_idx on public.contact_requests (created_at);
