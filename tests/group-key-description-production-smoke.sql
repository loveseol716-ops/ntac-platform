-- All authored fixtures, scheduling and permission changes roll back.
begin;
create temporary table key_fixture as select
 (select id from public.profiles where role='owner' order by id limit 1) admin_id,
 (select id from public.profiles where role='member' order by id limit 1) member_id;
grant select,update on key_fixture to authenticated;
alter table key_fixture add column class_id uuid,add column week_id uuid,add column linked_id uuid,add column template_id uuid,add column legacy_id uuid;
insert into public.group_members(user_id,active) select member_id,true from key_fixture on conflict(user_id) do update set active=true;
select set_config('request.jwt.claim.sub',(select admin_id::text from key_fixture),true);
set local role authenticated;
do $$ declare r jsonb; w public.group_weeks; programs jsonb; ws date; cid uuid; before_count integer; begin
 select (date_trunc('week',now() at time zone 'Asia/Seoul')::date+n*7) into ws from generate_series(10,200) n where not exists(select 1 from public.group_weeks where week_start=date_trunc('week',now() at time zone 'Asia/Seoul')::date+n*7 and status<>'archived') order by n limit 1;
 cid:=public.group_save_class(jsonb_build_object('title','key fixture class','starts_at',now()+interval '10 minutes','duration_minutes',50,'coach_id',(select admin_id from key_fixture),'description','PUBLIC CLASS','movements','[]'::jsonb,'key_description','SECRET_CLASS'));
 update key_fixture set class_id=cid;
 perform public.group_set_class_status(cid,'published',1);
 if public.group_detail(cid)#>>'{class,key_description}'<>'SECRET_CLASS' then raise exception 'Admin class note missing'; end if;
 update key_fixture set template_id=public.group_save_template(public.group_detail(cid)->'class');
 if not exists(select 1 from public.group_key_descriptions where template_id=(select template_id from key_fixture) and key_description='SECRET_CLASS') then raise exception 'Template lost private intent'; end if;
 select jsonb_agg(jsonb_build_object('class_type_id',id,'title',name,'description',case when id='gentle_strength' then 'PUBLIC WEEK' else '' end,'movements','[]'::jsonb,'key_description',case when id='gentle_strength' then 'SECRET_WEEK' else '' end)) into programs from public.group_class_types;
 r:=public.group_save_week(jsonb_build_object('week_start',ws,'title','key fixture week','program_mode','class_type','status','draft','programs',programs));
 update key_fixture set week_id=(r->>'id')::uuid;
 select * into w from public.group_weeks where id=(r->>'id')::uuid;
 if to_jsonb(w)::text like '%SECRET_%' or w.programs::text like '%key_description%' then raise exception 'Private intent leaked into public week'; end if;
 -- Old clients and one-click publication omit keys: existing notes must survive.
 perform public.group_save_week(to_jsonb(w)||jsonb_build_object('status','published'));
 select * into w from public.group_weeks where id=w.id;
 select id into cid from public.group_classes where week_id=w.id and class_type_id='gentle_strength' and archived_at is null order by starts_at limit 1;
 if cid is null or public.group_detail(cid)#>>'{class,key_description}'<>'SECRET_WEEK' then raise exception 'Scheduled class missing private week intent'; end if;
 update key_fixture set linked_id=cid;
 if not exists(select 1 from public.group_key_descriptions where week_id=w.id and key_description='SECRET_WEEK') then raise exception 'One-click publish erased note'; end if;
 before_count:=(select count(*) from public.group_classes);
 begin
  perform public.group_save_class(jsonb_build_object('title','key invalid fixture','starts_at',now()+interval '20 minutes','duration_minutes',50,'coach_id',(select admin_id from key_fixture),'description','PUBLIC','movements','[]'::jsonb,'key_description',repeat('x',4001)));
  raise exception 'Oversized note accepted';
 exception when others then if sqlerrm not like '%4,000%' then raise; end if; end;
 if (select count(*) from public.group_classes)<>before_count then raise exception 'Invalid note partially saved class'; end if;
 -- Legacy day payloads previously stored arbitrary JSON; strip private keys too.
 r:=public.group_save_week(jsonb_build_object('week_start',ws+7,'title','key fixture legacy','status','draft','days',jsonb_build_array(jsonb_build_object('dow',1,'title','Legacy','description','PUBLIC LEGACY','movements','[]'::jsonb,'key_description','SECRET_LEGACY'))));
 update key_fixture set legacy_id=(r->>'id')::uuid;
 if exists(select 1 from public.group_weeks where id=(r->>'id')::uuid and days::text like '%SECRET_%') then raise exception 'Legacy week leaked intent'; end if;
 if not exists(select 1 from public.group_key_descriptions where week_id=(r->>'id')::uuid and program_key='1' and key_description='SECRET_LEGACY') then raise exception 'Legacy note missing'; end if;
end $$;
reset role;
select set_config('request.jwt.claim.sub',(select member_id::text from key_fixture),true);
set local role authenticated;
do $$ declare c uuid; begin
 if exists(select 1 from public.group_key_descriptions) then raise exception 'Member read private intent'; end if;
 foreach c in array array[(select class_id from key_fixture),(select linked_id from key_fixture)] loop
  if public.group_detail(c)::text like '%SECRET_%' or (public.group_detail(c)->'class') ? 'key_description' then raise exception 'Member detail leaked intent'; end if;
 end loop;
 if exists(select 1 from public.group_weeks where programs::text like '%SECRET_%' or days::text like '%SECRET_%') then raise exception 'Week API leaked intent'; end if;
 if exists(select 1 from public.group_classes where description like '%SECRET_%') then raise exception 'Calendar API leaked intent'; end if;
 perform public.group_join((select class_id from key_fixture));
 if public.group_my_history()::text like '%SECRET_%' or public.group_my_history()::text like '%key_description%' then raise exception 'History leaked intent'; end if;
 begin insert into public.group_key_descriptions(class_id,key_description,updated_by) values((select class_id from key_fixture),'member tamper',(select member_id from key_fixture)); raise exception 'Member wrote private intent'; exception when insufficient_privilege then null; end;
end $$;
reset role;
do $$ begin
 if has_function_privilege('authenticated','private.group_store_key_description(text,uuid,text,jsonb)','EXECUTE') or has_function_privilege('authenticated','private.group_detail_content(uuid)','EXECUTE') or has_function_privilege('authenticated','private.group_save_week_content(jsonb)','EXECUTE') then raise exception 'Internal helper exposed'; end if;
 if has_function_privilege('anon','public.group_detail(uuid)','EXECUTE') or has_table_privilege('anon','public.group_key_descriptions','SELECT') then raise exception 'Anonymous intent access'; end if;
end $$;
rollback;
