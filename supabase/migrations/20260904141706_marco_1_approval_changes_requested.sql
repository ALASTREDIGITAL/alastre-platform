alter table public.approval_items
  drop constraint approval_items_status_check;

alter table public.approval_items
  add constraint approval_items_status_check
  check (status in ('pending','approved','rejected','changes_requested','cancelled'));
