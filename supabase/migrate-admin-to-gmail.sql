-- Run this once in Supabase SQL Editor to transfer inquiry-admin access.
drop policy if exists "Kongdary admin can view requests" on public.contact_requests;
drop policy if exists "Kongdary admin can update requests" on public.contact_requests;
drop policy if exists "Kongdary admin can delete requests" on public.contact_requests;

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
