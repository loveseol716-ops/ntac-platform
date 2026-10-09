-- Integration check: all fixture changes are rolled back. Run through a privileged SQL connection.
begin;
create temporary table pt_test_context as select
 (select id from public.profiles where role in ('owner','admin') limit 1) as admin_id,
 (select id from public.profiles where role='member' order by id limit 1) as member_id,
 (select id from public.profiles where role='member' order by id offset 1 limit 1) as other_id,
 gen_random_uuid() as pt_id, gen_random_uuid() as pack_id, gen_random_uuid() as session_id;
grant select on pt_test_context to authenticated;
select set_config('request.jwt.claim.sub',(select admin_id::text from pt_test_context),true);
set local role authenticated;
insert into public.pt_members(id,profile_id) select pt_id,member_id from pt_test_context;
insert into public.pt_packages(id,member_id,title,total_sessions,starts_on) select pack_id,pt_id,'ROLLBACK TEST',1,current_date-1 from pt_test_context;
select public.pt_save_session(jsonb_build_object('id',session_id,'member_id',pt_id,'package_id',pack_id,'session_date',current_date,'start_time','10:00','title','ROLLBACK TEST','status','completed','workout','[]'::jsonb,'private_note','PRIVATE')) from pt_test_context;
-- Idempotent retry must consume one session only.
select public.pt_save_session(jsonb_build_object('id',session_id,'member_id',pt_id,'package_id',pack_id,'session_date',current_date,'start_time','10:00','title','ROLLBACK TEST','status','completed','workout','[]'::jsonb,'private_note','PRIVATE')) from pt_test_context;
do $$ begin
 if (select count(*) from public.pt_sessions where package_id=(select pack_id from pt_test_context) and status='completed')<>1 then raise exception 'Duplicate charge'; end if;
 begin
  insert into public.pt_sessions(member_id,package_id,session_date,title,status) select pt_id,pack_id,current_date,'OVER LIMIT','completed' from pt_test_context;
  raise exception 'Capacity enforcement failed';
 exception when raise_exception then if SQLERRM <> '이용권의 남은 횟수가 없습니다.' then raise; end if; end;
end $$;
update public.pt_sessions set status='cancelled' where id=(select session_id from pt_test_context);
do $$ begin
 if (select count(*) from public.pt_sessions where package_id=(select pack_id from pt_test_context) and status='completed')<>0 then raise exception 'Reversal failed'; end if;
end $$;
update public.pt_sessions set status='completed' where id=(select session_id from pt_test_context);
-- Owner sees shared session, but never private notes. Member cannot alter attendance.
select set_config('request.jwt.claim.sub',(select member_id::text from pt_test_context),true);
do $$ begin
 if (select count(*) from public.pt_sessions where id=(select session_id from pt_test_context))<>1 then raise exception 'Owner read failed'; end if;
 if exists(select 1 from public.pt_session_private) then raise exception 'Private note leaked'; end if;
 update public.pt_sessions set status='cancelled' where id=(select session_id from pt_test_context);
 if found then raise exception 'Member modified attendance'; end if;
 begin
  perform public.pt_save_session('{}'); raise exception 'Member RPC allowed';
 exception when raise_exception then if SQLERRM <> '관리자 권한이 필요합니다.' then raise; end if; end;
end $$;
select set_config('request.jwt.claim.sub',(select other_id::text from pt_test_context),true);
do $$ begin
 if exists(select 1 from public.pt_sessions where id=(select session_id from pt_test_context)) then raise exception 'Other member can read session'; end if;
 if exists(select 1 from public.pt_packages where id=(select pack_id from pt_test_context)) then raise exception 'Other member can read package'; end if;
end $$;
reset role;
select 'PASS: idempotency, limit, reversal, member isolation, private notes, unauthorized writes' as result;
rollback;
