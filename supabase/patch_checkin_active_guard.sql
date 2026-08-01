-- Garante que cada crianca tenha no maximo um check-in ativo.
-- Tambem saneia check-ins legados ativos em salas fechadas, excluidas/inexistentes
-- ou duplicados por crianca antes de criar a trava.

begin;

-- Fecha check-ins ativos vinculados a salas que nao estao abertas.
update public.checkins c
set checked_out_at = coalesce(r.closed_at, now())
from public.rooms r
where c.room_id = r.id
  and c.checked_out_at is null
  and coalesce(r.status, '') <> 'Aberta';

-- Fecha check-ins ativos que apontam para salas inexistentes.
-- Em bancos com FK/on delete cascade correto isso normalmente nao encontra linhas,
-- mas cobre ambientes legados onde a constraint pode estar diferente.
update public.checkins c
set checked_out_at = now()
where c.checked_out_at is null
  and not exists (
    select 1
    from public.rooms r
    where r.id = c.room_id
  );

-- Se uma crianca ficou com mais de um check-in ativo, preserva apenas o mais recente.
with ranked_active as (
  select
    c.id,
    row_number() over (
      partition by c.student_id
      order by c.checked_in_at desc, c.id desc
    ) as active_rank
  from public.checkins c
  where c.checked_out_at is null
)
update public.checkins c
set checked_out_at = now()
from ranked_active ranked
where c.id = ranked.id
  and ranked.active_rank > 1;

-- Trava definitiva contra duplicidade ativa por crianca.
create unique index if not exists checkins_one_active_per_student
  on public.checkins (student_id)
  where checked_out_at is null;

commit;
