-- Data center: extracts obey existing RLS; recovery snapshots are SADMIN-only.
create or replace function public.log_report_snapshot()
returns jsonb language plpgsql stable security invoker set search_path=public,pg_catalog as $$
declare n text; rows jsonb; result jsonb:='{}'::jsonb;
begin
 if not public.is_staff_user(auth.uid()) then raise exception 'Sem permissao'; end if;
 foreach n in array array['students','student_guardians','profiles','rooms','checkins','audit_logs'] loop
   execute format('select coalesce(jsonb_agg(to_jsonb(r) order by to_jsonb(r)::text),''[]''::jsonb) from public.%I r',n) into rows;
   result:=result||jsonb_build_object(n,rows);
 end loop;
 return result;
end; $$;
create or replace function public.log_data_catalog()
returns jsonb language sql stable security invoker set search_path = public, pg_catalog as $$
 select coalesce(jsonb_agg(jsonb_build_object('name',t.table_name,'columns',(
   select jsonb_agg(c.column_name order by c.ordinal_position) from information_schema.columns c
   where c.table_schema='public' and c.table_name=t.table_name))), '[]'::jsonb)
 from information_schema.tables t where t.table_schema='public' and t.table_type='BASE TABLE'
 and public.is_admin_family_network_manager(auth.uid());
$$;

create or replace function public.log_extract_data(selected_tables text[])
returns jsonb language plpgsql stable security invoker set search_path = public, pg_catalog as $$
declare n text; result jsonb := '{}'::jsonb; rows jsonb;
begin
 if not public.is_admin_family_network_manager(auth.uid()) then raise exception 'Sem permissao'; end if;
 if coalesce(cardinality(selected_tables),0)=0 then raise exception 'Selecione os dados'; end if;
 foreach n in array selected_tables loop
   if not exists(select 1 from information_schema.tables where table_schema='public' and table_name=n and table_type='BASE TABLE') then
     raise exception 'Tabela indisponivel: %', n;
   end if;
   execute format('select coalesce(jsonb_agg(to_jsonb(r) order by to_jsonb(r)::text),''[]''::jsonb) from public.%I r',n) into rows;
   result := result || jsonb_build_object(n,rows);
 end loop;
 return result;
end; $$;

create or replace function public.log_recovery_snapshot(selected_tables text[] default null)
returns jsonb language plpgsql stable security definer set search_path = pg_catalog, public as $$
declare names text[]; n text; rec record; data jsonb := '{}'::jsonb; rows jsonb; cols jsonb; columns_map jsonb := '{}'::jsonb;
begin
 if not exists(select 1 from auth.users where id=auth.uid() and lower(email)='marvinlabre@gmail.com') then
   raise exception 'Backup de recuperacao permitido somente ao superadministrador';
 end if;
 select array_agg(table_name order by table_name) into names from information_schema.tables
 where table_schema='public' and table_type='BASE TABLE' and (selected_tables is null or table_name=any(selected_tables));
 if coalesce(cardinality(names),0)=0 or (selected_tables is not null and not names @> selected_tables) then raise exception 'Selecao de backup invalida'; end if;
 -- Include complete parent tables recursively so selected backups retain relationships.
 loop
   select array_agg(distinct name order by name) into selected_tables from (
     select unnest(names) name union
     select parent.relname from pg_constraint fk join pg_class child on child.oid=fk.conrelid
     join pg_class parent on parent.oid=fk.confrelid join pg_namespace ns on ns.oid=parent.relnamespace
     where fk.contype='f' and child.relnamespace='public'::regnamespace and child.relname=any(names) and ns.nspname='public'
     union
     -- Legacy production tables do not declare every logical FK.
     select dep.parent from (values
       ('checkins','students'),('checkins','rooms'),('checkins','profiles'),
       ('rooms','profiles'),('students','student_guardians'),('profiles','student_guardians')
     ) dep(child,parent) where dep.child=any(names)
   ) s;
   exit when names=selected_tables; names:=selected_tables;
 end loop;
 for rec in select 'public'::text ns,unnest(names) name union all select 'auth','users' union all select 'auth','identities' union all select 'auth','mfa_factors' loop
   n:=rec.ns||'.'||rec.name;
   execute format('select coalesce(jsonb_agg(to_jsonb(r) order by to_jsonb(r)::text),''[]''::jsonb) from %I.%I r',rec.ns,rec.name) into rows;
   select jsonb_agg(jsonb_build_object('name',a.attname,'type',format_type(a.atttypid,a.atttypmod),'generated',a.attgenerated) order by a.attnum)
   into cols from pg_attribute a where a.attrelid=format('%I.%I',rec.ns,rec.name)::regclass and a.attnum>0 and not a.attisdropped;
   data:=data||jsonb_build_object(n,rows); columns_map:=columns_map||jsonb_build_object(n,cols);
 end loop;
 return jsonb_build_object('tables',data,'columns',columns_map,
   'buckets',(select coalesce(jsonb_agg(to_jsonb(b) order by id),'[]'::jsonb) from storage.buckets b),
   'objects',(select coalesce(jsonb_agg(to_jsonb(o) order by bucket_id,name),'[]'::jsonb) from storage.objects o));
end; $$;

revoke all on function public.log_data_catalog() from public, anon;
revoke all on function public.log_report_snapshot() from public, anon;
revoke all on function public.log_extract_data(text[]) from public, anon;
revoke all on function public.log_recovery_snapshot(text[]) from public, anon;
grant execute on function public.log_data_catalog(), public.log_extract_data(text[]), public.log_recovery_snapshot(text[]) to authenticated;
grant execute on function public.log_report_snapshot() to authenticated;
notify pgrst, 'reload schema';
