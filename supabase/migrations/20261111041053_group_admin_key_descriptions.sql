-- Private author intent never lives in the member-readable program JSON/rows.
create table public.group_key_descriptions (
 id uuid primary key default gen_random_uuid(),
 week_id uuid references public.group_weeks(id) on delete cascade,
 class_id uuid references public.group_classes(id) on delete cascade,
 template_id uuid references public.group_templates(id) on delete cascade,
 program_key text not null default '',
 key_description text not null check(length(key_description)<=4000),
 updated_by uuid not null references public.profiles(id),
 updated_at timestamptz not null default now(),
 check(num_nonnulls(week_id,class_id,template_id)=1),
 check((week_id is not null and program_key<>'') or (week_id is null and program_key=''))
);
create unique index group_key_week_idx on public.group_key_descriptions(week_id,program_key) where week_id is not null;
create unique index group_key_class_idx on public.group_key_descriptions(class_id) where class_id is not null;
create unique index group_key_template_idx on public.group_key_descriptions(template_id) where template_id is not null;
create index group_key_author_idx on public.group_key_descriptions(updated_by);
alter table public.group_key_descriptions enable row level security;
revoke all on public.group_key_descriptions from public,anon,authenticated;
grant select on public.group_key_descriptions to authenticated;
create policy group_key_admin_read on public.group_key_descriptions for select to authenticated using((select public.is_ntac_admin()));

-- Internal helper: callable only from the privileged, authorized save pipeline.
create function private.group_store_key_description(kind text,target uuid,pkey text,note jsonb)
returns void language plpgsql security invoker set search_path='' as $$
declare text_value text;
begin
 if auth.uid() is null or not public.is_ntac_admin() then raise exception 'Key Description은 관리자만 작성할 수 있어요.'; end if;
 if note is not null and note<>'null'::jsonb and jsonb_typeof(note)<>'string' then raise exception 'Key Description은 글로 입력해 주세요.'; end if;
 text_value:=coalesce(note#>>'{}','');
 if length(text_value)>4000 then raise exception 'Key Description은 4,000자 이내로 입력해 주세요.'; end if;
 if kind='week' then
  insert into public.group_key_descriptions(week_id,program_key,key_description,updated_by) values(target,pkey,text_value,auth.uid())
  on conflict(week_id,program_key) where week_id is not null do update set key_description=excluded.key_description,updated_by=excluded.updated_by,updated_at=now();
 elsif kind='class' then
  insert into public.group_key_descriptions(class_id,key_description,updated_by) values(target,text_value,auth.uid())
  on conflict(class_id) where class_id is not null do update set key_description=excluded.key_description,updated_by=excluded.updated_by,updated_at=now();
 elsif kind='template' then
  insert into public.group_key_descriptions(template_id,key_description,updated_by) values(target,text_value,auth.uid())
  on conflict(template_id) where template_id is not null do update set key_description=excluded.key_description,updated_by=excluded.updated_by,updated_at=now();
 else raise exception '프로그램 종류를 확인해 주세요.'; end if;
end $$;
revoke all on function private.group_store_key_description(text,uuid,text,jsonb) from public,anon,authenticated;

-- Retain existing validation, revision locks, scheduling and frozen-record rules.
-- Move the original implementations off the public RPC surface.
alter function public.group_save_week(jsonb) set schema private;
alter function private.group_save_week(jsonb) rename to group_save_week_content;
alter function public.group_save_class(jsonb) set schema private;
alter function private.group_save_class(jsonb) rename to group_save_class_content;
alter function public.group_save_template(jsonb) set schema private;
alter function private.group_save_template(jsonb) rename to group_save_template_content;
alter function public.group_detail(uuid) set schema private;
alter function private.group_detail(uuid) rename to group_detail_content;
revoke all on function private.group_save_week_content(jsonb),private.group_save_class_content(jsonb),private.group_save_template_content(jsonb),private.group_detail_content(uuid) from public,anon,authenticated;

create function private.group_save_week_with_keys(payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare clean jsonb:=payload-'key_description'; items jsonb; item jsonb; field text; r jsonb;
begin
 if auth.uid() is null or not public.is_ntac_admin() then raise exception '주간 프로그램은 관리자만 만들 수 있어요.'; end if;
 foreach field in array array['programs','days'] loop
  if payload ? field then
   if jsonb_typeof(payload->field)<>'array' then raise exception '주간 프로그램 형식을 확인해 주세요.'; end if;
   select coalesce(jsonb_agg(value-'key_description'),'[]'::jsonb) into items from jsonb_array_elements(payload->field);
   clean:=jsonb_set(clean,array[field],items);
  end if;
 end loop;
 r:=private.group_save_week_content(clean);
 field:=case when payload->>'program_mode'='class_type' then 'programs' else 'days' end;
 for item in select value from jsonb_array_elements(payload->field) loop
  if item ? 'key_description' then
   perform private.group_store_key_description('week',(r->>'id')::uuid,coalesce(item->>'class_type_id',item->>'dow'),item->'key_description');
  end if;
 end loop;
 return r;
end $$;
create function public.group_save_week(payload jsonb) returns jsonb
language sql security invoker set search_path='' as $$ select private.group_save_week_with_keys(payload); $$;

create function private.group_save_class_with_keys(payload jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare cid uuid;
begin
 cid:=private.group_save_class_content(payload-'key_description');
 if payload ? 'key_description' then perform private.group_store_key_description('class',cid,'',payload->'key_description'); end if;
 return cid;
end $$;
create function public.group_save_class(payload jsonb) returns uuid
language sql security invoker set search_path='' as $$ select private.group_save_class_with_keys(payload); $$;

create function private.group_save_template_with_keys(payload jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare tid uuid;
begin
 tid:=private.group_save_template_content(payload-'key_description');
 if payload ? 'key_description' then perform private.group_store_key_description('template',tid,'',payload->'key_description'); end if;
 return tid;
end $$;
create function public.group_save_template(payload jsonb) returns uuid
language sql security invoker set search_path='' as $$ select private.group_save_template_with_keys(payload); $$;

create function private.group_detail_with_keys(cid uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare r jsonb; note text; c public.group_classes;
begin
 r:=private.group_detail_content(cid);
 if public.is_ntac_admin() then
  select * into c from public.group_classes where id=cid;
  select key_description into note from public.group_key_descriptions where class_id=cid;
  if not found and c.week_id is not null then
   select k.key_description into note from public.group_key_descriptions k join public.group_weeks w on w.id=k.week_id
   where k.week_id=c.week_id and k.program_key=case when w.program_mode='class_type' then c.class_type_id else extract(isodow from c.starts_at at time zone 'Asia/Seoul')::integer::text end;
  end if;
  r:=jsonb_set(r,'{class}',(r->'class')||jsonb_build_object('key_description',coalesce(note,'')));
 end if;
 return r;
end $$;
create function public.group_detail(cid uuid) returns jsonb
language sql stable security invoker set search_path='' as $$ select private.group_detail_with_keys(cid); $$;

revoke all on function private.group_save_week_with_keys(jsonb),private.group_save_class_with_keys(jsonb),private.group_save_template_with_keys(jsonb),private.group_detail_with_keys(uuid),public.group_save_week(jsonb),public.group_save_class(jsonb),public.group_save_template(jsonb),public.group_detail(uuid) from public,anon,authenticated;
grant execute on function private.group_save_week_with_keys(jsonb),private.group_save_class_with_keys(jsonb),private.group_save_template_with_keys(jsonb),private.group_detail_with_keys(uuid),public.group_save_week(jsonb),public.group_save_class(jsonb),public.group_save_template(jsonb),public.group_detail(uuid) to authenticated;
notify pgrst,'reload schema';
