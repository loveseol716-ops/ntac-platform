-- Fully rolled back, including fixtures, permissions, audit rows and generated classes.
begin;
create temporary table publication_fixture as
select (select id from public.profiles where role='owner' order by id limit 1) admin_id,
       (select id from public.profiles where role='member' order by id limit 1) member_id,
       gen_random_uuid() week_id, gen_random_uuid() past_id, gen_random_uuid() future_id,
       gen_random_uuid() manual_id;
grant select on publication_fixture to authenticated;
do $$ begin if exists(select 1 from publication_fixture where admin_id is null or member_id is null) then raise exception 'Test accounts unavailable'; end if; end $$;
insert into public.group_members(user_id,active) select member_id,true from publication_fixture on conflict(user_id) do update set active=true;
insert into public.group_weeks(id,week_start,title,status,created_by,program_mode,programs)
select f.week_id,d.fixture_date,'publication rollback fixture','published',f.admin_id,'class_type',
 (select jsonb_agg(jsonb_build_object('class_type_id',id,'title',name,'description',case when id='gentle_strength' then 'PRIVATE PROGRAM' else '' end,'movements','[]'::jsonb)) from public.group_class_types)
from publication_fixture f cross join lateral (
 select (date_trunc('week',now() at time zone 'Asia/Seoul')::date + n*7) as fixture_date from generate_series(10,200) n
 where not exists(select 1 from public.group_weeks w where w.week_start=date_trunc('week',now() at time zone 'Asia/Seoul')::date+n*7 and status<>'archived') order by n limit 1
) d;
insert into public.group_classes(id,title,starts_at,coach_id,created_by,status,description,movements,week_id)
select past_id,'past rollback fixture',now()-interval '1 day',admin_id,admin_id,'ended','PRIVATE PROGRAM','[{"id":"m","exercise_id":"back_squat","label":"Squat","kind":"weight","unit":"kg","target_reps":8}]'::jsonb,week_id from publication_fixture
union all
select future_id,'future rollback fixture',now()+interval '10 minutes',admin_id,admin_id,'published','PRIVATE PROGRAM','[]'::jsonb,week_id from publication_fixture
union all
select manual_id,'standalone rollback fixture',now()+interval '20 minutes',admin_id,admin_id,'published','','[]'::jsonb,null::uuid from publication_fixture;
insert into public.group_participants(class_id,user_id,status,results,session_rpe)
select past_id,member_id,'completed','{"m":{"weight":60,"reps":8}}'::jsonb,7 from publication_fixture;
select set_config('request.jwt.claim.sub',(select member_id::text from publication_fixture),true);
set local role authenticated;
do $$ begin
 if (select count(*) from public.group_classes where id in (select past_id from publication_fixture union all select future_id from publication_fixture union all select manual_id from publication_fixture))<>3 then raise exception 'Published classes hidden'; end if;
 begin perform public.group_unpublish_week((select week_id from publication_fixture),1); raise exception 'Member unpublish allowed'; exception when others then if sqlerrm not like '%관리자%' then raise; end if; end;
end $$;
reset role;
select set_config('request.jwt.claim.sub',(select admin_id::text from publication_fixture),true);
set local role authenticated;
do $$ begin
 begin perform public.group_unpublish_week((select week_id from publication_fixture),999); raise exception 'Stale revision accepted'; exception when others then if sqlerrm not like '%변경%' then raise; end if; end;
 perform public.group_unpublish_week((select week_id from publication_fixture),1);
 if not exists(select 1 from public.group_weeks where id=(select week_id from publication_fixture) and status='draft' and revision=2 and programs::text like '%PRIVATE PROGRAM%') then raise exception 'Draft not retained'; end if;
end $$;
reset role;
select set_config('request.jwt.claim.sub',(select member_id::text from publication_fixture),true);
set local role authenticated;
do $$ declare h jsonb; begin
 if exists(select 1 from public.group_weeks where id=(select week_id from publication_fixture)) then raise exception 'Withdrawn week leaked'; end if;
 if exists(select 1 from public.group_classes where id in (select past_id from publication_fixture union all select future_id from publication_fixture)) then raise exception 'Withdrawn occurrence leaked'; end if;
 if not exists(select 1 from public.group_classes where id=(select manual_id from publication_fixture)) then raise exception 'Standalone class affected'; end if;
 begin perform public.group_detail((select past_id from publication_fixture)); raise exception 'Direct detail leaked'; exception when others then if sqlerrm not like '%권한%' then raise; end if; end;
 begin perform public.group_join((select future_id from publication_fixture)); raise exception 'Withdrawn join accepted'; exception when others then if sqlerrm not like '%공개가 취소%' then raise; end if; end;
 select value into h from jsonb_array_elements(public.group_my_history()) where value->>'class_id'=(select past_id::text from publication_fixture);
 if h is null or (h#>>'{results,m,weight}')::numeric<>60 or h#>>'{group_classes,program_hidden}'<>'true' or h::text like '%PRIVATE PROGRAM%' then raise exception 'Personal history invalid'; end if;
end $$;
reset role;
select set_config('request.jwt.claim.sub',(select admin_id::text from publication_fixture),true);
set local role authenticated;
do $$ declare w public.group_weeks; begin
 select * into w from public.group_weeks where id=(select week_id from publication_fixture);
 perform public.group_save_week(to_jsonb(w)||jsonb_build_object('status','published'));
 if not exists(select 1 from public.group_weeks where id=w.id and status='published' and revision=3) then raise exception 'Republish failed'; end if;
end $$;
reset role;
select set_config('request.jwt.claim.sub',(select member_id::text from publication_fixture),true);
set local role authenticated;
do $$ begin if not exists(select 1 from public.group_classes where id=(select past_id from publication_fixture)) then raise exception 'Republished occurrence hidden'; end if; end $$;
reset role;
select set_config('request.jwt.claim.sub',(select admin_id::text from publication_fixture),true);
set local role authenticated;
select public.group_remove_program('week',(select week_id from publication_fixture),3);
reset role;
select set_config('request.jwt.claim.sub',(select member_id::text from publication_fixture),true);
set local role authenticated;
do $$ begin
 if exists(select 1 from public.group_classes where id=(select past_id from publication_fixture)) then raise exception 'Deleted past occurrence leaked'; end if;
 if not exists(select 1 from public.group_participants where class_id=(select past_id from publication_fixture) and results#>>'{m,weight}'='60') then raise exception 'Deletion lost results'; end if;
end $$;
reset role;
do $$ begin
 if has_function_privilege('anon','public.group_unpublish_week(uuid,integer)','EXECUTE') or has_function_privilege('anon','private.group_unpublish_week(uuid,integer)','EXECUTE') then raise exception 'Anonymous unpublish exposed'; end if;
end $$;
rollback;
