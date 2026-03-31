-- Padroniza telefones para: +55 (DD) 9XXXX-XXXX
-- Aplica em profiles.phone e students.phone

begin;

create or replace function public.normalize_phone_br(phone_text text)
returns text
language plpgsql
as $$
declare
  digits text;
  ddd text;
  number_part text;
begin
  digits := regexp_replace(coalesce(phone_text, ''), '\D', '', 'g');
  if digits = '' then
    return null;
  end if;

  if length(digits) > 11 and left(digits, 2) = '55' then
    digits := substr(digits, 3);
  end if;

  if length(digits) > 11 and substr(digits, 1, 2) = substr(digits, 3, 2) then
    digits := substr(digits, 1, 2) || substr(digits, 5);
  end if;

  if length(digits) > 11 then
    digits := right(digits, 11);
  end if;

  if length(digits) < 10 then
    return null;
  end if;

  ddd := substr(digits, 1, 2);
  number_part := substr(digits, 3);

  if length(number_part) = 9 then
    return format('+55 (%s) %s-%s', ddd, substr(number_part, 1, 5), substr(number_part, 6, 4));
  elsif length(number_part) = 8 then
    return format('+55 (%s) %s-%s', ddd, substr(number_part, 1, 4), substr(number_part, 5, 4));
  end if;

  return null;
end;
$$;

create or replace function public.is_phone_br_format(phone_text text)
returns boolean
language sql
immutable
as $$
  select phone_text ~ '^\+55 \([0-9]{2}\) [0-9]{4,5}-[0-9]{4}$'
$$;

create or replace function public.tg_normalize_phone_columns()
returns trigger
language plpgsql
as $$
begin
  new.phone := public.normalize_phone_br(new.phone);
  return new;
end;
$$;

drop trigger if exists trg_profiles_normalize_phone on public.profiles;
create trigger trg_profiles_normalize_phone
before insert or update of phone on public.profiles
for each row
execute function public.tg_normalize_phone_columns();

drop trigger if exists trg_students_normalize_phone on public.students;
create trigger trg_students_normalize_phone
before insert or update of phone on public.students
for each row
execute function public.tg_normalize_phone_columns();

alter table public.students
  alter column phone drop not null;

update public.profiles
set phone = public.normalize_phone_br(phone)
where phone is not null;

update public.students
set phone = public.normalize_phone_br(phone)
where phone is not null;

alter table public.profiles
  drop constraint if exists profiles_phone_format_chk;
alter table public.profiles
  add constraint profiles_phone_format_chk
  check (phone is null or public.is_phone_br_format(phone));

alter table public.students
  drop constraint if exists students_phone_format_chk;
alter table public.students
  add constraint students_phone_format_chk
  check (phone is null or public.is_phone_br_format(phone));

commit;
