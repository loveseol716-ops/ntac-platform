begin;
create temporary table visibility_fixture as
select (select id from public.profiles where role='owner' order by id limit 1) as admin_id,
       (select id from public.profiles where role='member' order by id limit 1) as member_id,
       gen_random_uuid() as old_id, gen_random_uuid() as recent_id, gen_random_uuid() as week_id,
       private.group_program_visible_from() as cutoff;
grant select on visibility_fixture to authenticated;
do $$ begin if exists(select 1 from visibility_fixture where admin_id is null or member_id is null) then raise exception 'Test accounts unavailable'; end if; end $$;
insert into public.group_members(user_id,active) select member_id,true from visibility_fixture on conflict(user_id) do update set active=true;
insert into public.group_classes(id,title,starts_at,coach_id,created_by,status,description,movements)
select old_id,'visibility rollback fixture',(cutoff::timestamp at time zone 'Asia/Seoul') - interval '1 second',admin_id,admin_id,'ended','PRIVATE OLD BODY','[{"id":"m","exercise_id":"back_squat","label":"백 스쿼트","kind":"weight","unit":"kg","target_reps":10}]'::jsonb from visibility_fixture
union all
select recent_id,'visibility boundary fixture',cutoff::timestamp at time zone 'Asia/Seoul',admin_id,admin_id,'published','','[]'::jsonb from visibility_fixture;
insert into public.group_participants(class_id,user_id,status,results,session_rpe)
select old_id,member_id,'completed','{"m":{"weight":60,"reps":8}}',7 from visibility_fixture;
insert into public.group_weeks(id,title,week_start,status,created_by,days)
select f.week_id,'visibility rollback week',d.day,'published',f.admin_id,'[{"dow":1,"description":"PRIVATE OLD BODY"}]'::jsonb
from visibility_fixture f cross join lateral (select (f.cutoff-n*7)::date as day from generate_series(2,200) n where not exists(select 1 from public.group_weeks w where w.week_start=f.cutoff-n*7 and status<>'archived') order by n limit 1) d;
select set_config('request.jwt.claim.sub',(select member_id::text from visibility_fixture),true),set_config('request.jwt.claims',jsonb_build_object('sub',(select member_id from visibility_fixture),'role','authenticated')::text,true);
set local role authenticated;
do $$ declare h jsonb; old uuid; begin
 select old_id into old from visibility_fixture;
 if exists(select 1 from public.group_classes where id=old) then raise exception 'Old class leaked'; end if;
 if not exists(select 1 from public.group_classes where id=(select recent_id from visibility_fixture)) then raise exception 'Boundary class hidden'; end if;
 if exists(select 1 from public.group_weeks where id=(select week_id from visibility_fixture)) then raise exception 'Old week leaked'; end if;
 begin perform public.group_detail(old); raise exception 'Old detail leaked'; exception when others then if sqlerrm not like '%권한%' then raise; end if; end;
 select value into h from jsonb_array_elements(public.group_my_history()) where value->>'class_id'=old::text;
 if h is null or (h#>>'{results,m,weight}')::numeric<>60 or (h->>'session_rpe')::numeric<>7 or h::text like '%PRIVATE OLD BODY%' or h#>'{group_classes,description}' is not null then raise exception 'History projection invalid'; end if;
 if public.group_bootstrap()->>'program_visible_from' <> (select cutoff::text from visibility_fixture) then raise exception 'Cutoff mismatch'; end if;
end $$;
reset role;
select set_config('request.jwt.claim.sub',(select admin_id::text from visibility_fixture),true),set_config('request.jwt.claims',jsonb_build_object('sub',(select admin_id from visibility_fixture),'role','authenticated')::text,true);
set local role authenticated;
do $$ begin
 if (public.group_detail((select old_id from visibility_fixture))#>>'{class,description}')<>'PRIVATE OLD BODY' then raise exception 'Admin history hidden'; end if;
 if not exists(select 1 from public.group_weeks where id=(select week_id from visibility_fixture)) then raise exception 'Admin week hidden'; end if;
end $$;
reset role;
do $$ begin if has_function_privilege('anon','public.group_my_history()','EXECUTE') then raise exception 'Anonymous history exposed'; end if; end $$;
rollback;
select 'PASS: hosted RLS cutoff, direct detail denial, own record projection, admin archive and anonymous denial; all fixtures rolled back' as result;
