begin;
create temporary table change_test as select
 (select id from public.profiles where role in ('owner','admin') limit 1) admin,
 (select id from public.profiles where role='member' and id not in(select profile_id from public.pt_members) order by id limit 1) coach,
 (select id from public.profiles where role='member' and id not in(select profile_id from public.pt_members) order by id offset 1 limit 1) member,
 (select id from public.profiles where role='member' and id not in(select profile_id from public.pt_members) order by id offset 2 limit 1) stranger,
 gen_random_uuid() mid,gen_random_uuid() pack,gen_random_uuid() first_slot,gen_random_uuid() target_slot,gen_random_uuid() occupied_slot,gen_random_uuid() boundary_slot;
grant select on change_test to authenticated;
select set_config('request.jwt.claim.sub',(select admin::text from change_test),true);
set local role authenticated;
select public.register_pt_coach(coach) from change_test;
insert into public.pt_members(id,profile_id,coach_id) select mid,member,coach from change_test;
insert into public.pt_members(profile_id,coach_id) select stranger,coach from change_test;
insert into public.pt_packages(id,member_id,title,total_sessions,starts_on) select pack,mid,'ROLLBACK TEST',3,current_date-7 from change_test;
select set_config('request.jwt.claim.sub',(select coach::text from change_test),true);
insert into public.pt_slots(id,coach_id,starts_at,ends_at)
select first_slot,coach,now()+interval '2 days',now()+interval '2 days 1 hour' from change_test union all
select target_slot,coach,now()+interval '3 days',now()+interval '3 days 1 hour' from change_test union all
select occupied_slot,coach,now()+interval '4 days',now()+interval '4 days 1 hour' from change_test union all
select boundary_slot,coach,now()+interval '1 hour',now()+interval '2 hours' from change_test;
select set_config('request.jwt.claim.sub',(select member::text from change_test),true);
select public.pt_book_slot(first_slot),public.pt_book_slot(occupied_slot),public.pt_book_slot(boundary_slot) from change_test;
-- All three package uses are reserved. Reschedule must still work without a new use.
do $$ declare sid uuid; begin
 select id into sid from public.pt_sessions where slot_id=(select first_slot from change_test);
 perform public.pt_change_booking(sid,(select target_slot from change_test));
 if (select slot_id from public.pt_sessions where id=sid)<>(select target_slot from change_test) then raise exception 'Reschedule failed';end if;
 if (select count(*) from public.pt_sessions where member_id=(select mid from change_test))<>3 then raise exception 'Reschedule duplicated session';end if;
 begin perform public.pt_change_booking(sid,(select occupied_slot from change_test));raise exception 'Collision accepted';exception when raise_exception then if SQLERRM<>'이미 예약된 시간입니다. 기존 예약은 유지됩니다.' then raise;end if;end;
 if (select slot_id from public.pt_sessions where id=sid)<>(select target_slot from change_test) then raise exception 'Failed change lost original';end if;
 begin perform public.pt_change_booking((select id from public.pt_sessions where slot_id=(select boundary_slot from change_test)),null);raise exception 'Boundary cancel accepted';exception when raise_exception then if SQLERRM<>'수업 시작 1시간 이내에는 담당 코치에게 문의해 주세요.' then raise;end if;end;
 begin perform public.pt_change_booking((select id from public.pt_sessions where slot_id=(select boundary_slot from change_test)),(select first_slot from change_test));raise exception 'Boundary change accepted';exception when raise_exception then if SQLERRM<>'수업 시작 1시간 이내에는 담당 코치에게 문의해 주세요.' then raise;end if;end;
 update public.pt_sessions set warm_up='forbidden' where id=sid;
 if found then raise exception 'Direct member update permitted';end if;
 perform public.pt_change_booking(sid,null);
 if (select status from public.pt_sessions where id=sid)<>'cancelled' then raise exception 'Cancel failed';end if;
end $$;
select set_config('test.reservation_id',(select id::text from public.pt_sessions where slot_id=(select occupied_slot from change_test)),true);
-- An unrelated member cannot change another member's reservation.
select set_config('request.jwt.claim.sub',(select stranger::text from change_test),true);
do $$ begin
 begin perform public.pt_change_booking(current_setting('test.reservation_id')::uuid,null);raise exception 'Unrelated member accepted';exception when raise_exception then if SQLERRM not in ('PT 등록이 필요합니다.','본인의 예약만 변경할 수 있습니다.') then raise;end if;end;
end $$;
-- Assigned coach may cancel inside the cutoff. Notes never gate completion.
select set_config('request.jwt.claim.sub',(select coach::text from change_test),true);
select public.pt_set_session_status(s.id,'cancelled') from public.pt_sessions s join change_test t on s.slot_id=t.boundary_slot;
do $$ declare sid uuid; begin
 sid:=public.pt_save_simple_session(jsonb_build_object('member_id',(select mid from change_test),'session_date',current_date-1,'start_time','09:00'));
 perform public.pt_set_session_status(sid,'completed');
 if not exists(select 1 from public.pt_sessions where id=sid and status='completed' and warm_up='' and main='' and notes='') then raise exception 'Blank completion failed';end if;
 perform public.pt_save_simple_session(jsonb_build_object('id',sid,'member_id',(select mid from change_test),'main','AFTER COMPLETION'));
 if not exists(select 1 from public.pt_sessions where id=sid and status='completed' and main='AFTER COMPLETION') then raise exception 'Post workout notes changed status';end if;
 select id into sid from public.pt_sessions where slot_id=(select occupied_slot from change_test);
 perform public.pt_save_simple_session(jsonb_build_object('id',sid,'member_id',(select mid from change_test),'warm_up','BEFORE WORKOUT'));
 if not exists(select 1 from public.pt_sessions where id=sid and status='scheduled' and warm_up='BEFORE WORKOUT') then raise exception 'Pre workout notes changed status';end if;
end $$;
reset role;
select 'PASS: full-capacity reschedule, collision rollback, exact 1h cutoff, member ownership, direct writes denied, coach exception, blank completion, pre/post notes' result;
rollback;
