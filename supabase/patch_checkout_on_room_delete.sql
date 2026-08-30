-- Garante que a exclusao de sala nunca deixe check-ins ativos orfaos.
-- Aplicar em producao quando checkins.room_id nao tiver FK ou quando a sala puder ser removida antes do checkout.

create or replace function public.checkout_open_checkins_before_room_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.checkins
     set checked_out_at = coalesce(old.closed_at, now())
   where room_id = old.id
     and checked_out_at is null;

  return old;
end;
$$;

revoke all on function public.checkout_open_checkins_before_room_delete() from public;

drop trigger if exists checkout_open_checkins_before_room_delete_trigger on public.rooms;
create trigger checkout_open_checkins_before_room_delete_trigger
before delete on public.rooms
for each row execute function public.checkout_open_checkins_before_room_delete();

-- Saneia check-ins ativos que ja ficaram apontando para salas inexistentes.
update public.checkins c
   set checked_out_at = now()
 where c.checked_out_at is null
   and not exists (
     select 1
       from public.rooms r
      where r.id = c.room_id
   );
