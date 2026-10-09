begin;
create temp table access_test as select
 (select id from public.profiles where role in ('admin','owner') limit 1) as admin_id,
 (select id from public.profiles where role='member' order by id limit 1) as coach_id,
 (select id from public.profiles where role='member' order by id offset 1 limit 1) as member_id,
 (select id from public.profiles where role='member' order by id offset 2 limit 1) as other_id,
 gen_random_uuid() as package_id,gen_random_uuid() as session_id,gen_random_uuid() as slot_id;
grant select on access_test to authenticated;
select set_config('request.jwt.claim.sub',(select admin_id::text from access_test),true);
set local role authenticated;
select public.register_pt_coach(coach_id) from access_test;
select public.set_member_services(member_id,false,true,coach_id) from access_test;
do $$ begin
 if not exists(select 1 from public.profiles where id=(select member_id from access_test) and not ntac_enabled and assigned_coach_id=(select coach_id from access_test) and trial_ends_at is null) then raise exception 'PT-only assignment failed'; end if;
end $$;
select public.set_member_services(member_id,true,true,coach_id) from access_test;
insert into public.pt_packages(id,member_id,title,total_sessions,starts_on) select t.package_id,m.id,'ROLLBACK TEST',2,current_date-1 from access_test t join public.pt_members m on m.profile_id=t.member_id;
select set_config('request.jwt.claim.sub',(select coach_id::text from access_test),true);
insert into public.pt_slots(id,coach_id,starts_at,ends_at) select slot_id,coach_id,((current_date+3)+time '10:00') at time zone 'Asia/Seoul',((current_date+3)+time '11:00') at time zone 'Asia/Seoul' from access_test;
select public.pt_save_session(jsonb_build_object('id',t.session_id,'member_id',m.id,'package_id',t.package_id,'session_date',current_date-1,'start_time','10:00','title','ROLLBACK TEST','status','completed','workout','[]'::jsonb,'private_note','COACH ONLY')) from access_test t join public.pt_members m on m.profile_id=t.member_id;
do $$ begin
 if (select count(*) from public.pt_sessions where id=(select session_id from access_test))<>1 then raise exception 'Assigned coach cannot read'; end if;
 begin perform public.set_member_services((select member_id from access_test),true,false,null);raise exception 'Coach was able to assign';exception when raise_exception then if SQLERRM<>'관리자만 이용 구분과 담당 코치를 지정할 수 있습니다.' then raise;end if;end;
 update public.pt_members set coach_id=null where profile_id=(select member_id from access_test);if found then raise exception 'Coach changed assignment';end if;
end $$;
select set_config('request.jwt.claim.sub',(select other_id::text from access_test),true);
do $$ begin
 if exists(select 1 from public.pt_sessions where id=(select session_id from access_test)) then raise exception 'Unassigned member read';end if;
 update public.pt_slots set is_open=false where id=(select slot_id from access_test);if found then raise exception 'Unassigned user changed availability';end if;
end $$;
select set_config('request.jwt.claim.sub',(select member_id::text from access_test),true);
do $$ begin
 if not exists(select 1 from public.pt_sessions where id=(select session_id from access_test)) then raise exception 'Member own read failed';end if;
 if not exists(select 1 from public.pt_open_slots((select id from public.pt_members where profile_id=auth.uid())) where id=(select slot_id from access_test)) then raise exception 'Coach availability missing';end if;
 if exists(select 1 from public.pt_session_private where session_id=(select session_id from access_test)) then raise exception 'Private notes leaked';end if;
end $$;
select set_config('request.jwt.claim.sub',(select admin_id::text from access_test),true);
select public.set_member_services(member_id,true,false,null) from access_test;
do $$ begin
 if exists(select 1 from public.pt_members where profile_id=(select member_id from access_test) and active) then raise exception 'PT disable failed';end if;
 if not exists(select 1 from public.profiles where id=(select member_id from access_test) and ntac_enabled) then raise exception 'NTAC-only failed';end if;
end $$;
reset role;
select 'PASS: PT-only / both / NTAC-only, admin assignment, assigned-coach write, blocked reassignment, member isolation' as result;
rollback;
