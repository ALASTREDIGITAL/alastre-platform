-- Marco 1: ajuste de desempenho e políticas RLS sem sobreposição.

create index integrations_client_id_idx
  on public.integrations (client_id)
  where client_id is not null;

drop policy if exists integrations_write_admin on public.integrations;

create policy integrations_insert_admin
  on public.integrations
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.agency_members member
      where member.agency_id = integrations.agency_id
        and member.user_id = (select auth.uid())
        and member.active
        and member.role in ('owner', 'admin')
    )
  );

create policy integrations_update_admin
  on public.integrations
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.agency_members member
      where member.agency_id = integrations.agency_id
        and member.user_id = (select auth.uid())
        and member.active
        and member.role in ('owner', 'admin')
    )
  )
  with check (
    exists (
      select 1
      from public.agency_members member
      where member.agency_id = integrations.agency_id
        and member.user_id = (select auth.uid())
        and member.active
        and member.role in ('owner', 'admin')
    )
  );

create policy integrations_delete_admin
  on public.integrations
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.agency_members member
      where member.agency_id = integrations.agency_id
        and member.user_id = (select auth.uid())
        and member.active
        and member.role in ('owner', 'admin')
    )
  );

