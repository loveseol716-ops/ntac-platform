-- Transaction-local fixtures only. No member data persists after this test.
begin;
create temporary table ctx as select
 (select id from public.profiles where role in ('owner','admin') limit 1) admin,
 (select id from public.profiles where role='member' and id not in(select profile_id from public.pt_members) order by id limit 1) member1,
 (select id from public.profiles where role='member' and id not in(select profile_id from public.pt_members) order by id offset 1 limit 1) member2,
 gen_random_uuid() mid1,gen_random_uuid() mid2,gen_random_uuid() pack1,gen_random_uuid() pack2,gen_random_uuid() slot1,gen_random_uuid() slot2,gen_random_uuid() past_session;
grant select on ctx to authenticated;
select set_config('request.jwt.claim.sub',(select admin::text from ctx),true);
set local role authenticated;
insert into public.pt_members(id,profile_id,coach_id) select mid1,member1,admin from ctx union all select mid2,member2,admin from ctx;
insert into public.pt_packages(id,member_id,title,total_sessions,starts_on) select pack1,mid1,'ROLLBACK TEST',2,current_date-2 from ctx union all select pack2,mid2,'ROLLBACK TEST',2,current_date-2 from ctx;
insert into public.pt_slots(id,coach_id,starts_at,ends_at) select slot1,admin,((current_date+2)+time '10:00') at time zone 'Asia/Seoul',((current_date+2)+time '11:00') at time zone 'Asia/Seoul' from ctx union all select slot2,admin,((current_date+2)+time '11:00') at time zone 'Asia/Seoul',((current_date+2)+time '12:00') at time zone 'Asia/Seoul' from ctx;
select set_config('request.jwt.claim.sub',(select member1::text from ctx),true);
do $$ declare sid uuid; begin
 if (select count(*) from public.pt_open_slots((select mid1 from ctx)))<>2 then raise exception 'Open slots missing'; end if;
 sid:=public.pt_book_slot((select slot1 from ctx));
 if public.pt_book_slot((select slot1 from ctx))<>sid then raise exception 'Booking not idempotent'; end if;
 if exists(select 1 from public.pt_sessions where member_id=(select mid1 from ctx) and status='completed') then raise exception 'Booking deducted a session'; end if;
 begin perform public.pt_set_session_status(sid,'completed');raise exception 'Member completed session';exception when raise_exception then if SQLERRM<>'담당 코치 권한이 필요합니다.' then raise;end if;end;
 begin insert into public.pt_slots(coach_id,starts_at,ends_at) select admin,now()+interval '10 days',now()+interval '10 days 1 hour' from ctx; raise exception 'Member opened slot';exception when insufficient_privilege then null; when raise_exception then if SQLERRM<>'코치 계정이 필요합니다.' then raise;end if;end;
end $$;
select set_config('request.jwt.claim.sub',(select member2::text from ctx),true);
do $$ begin
 if (select count(*) from public.pt_open_slots((select mid2 from ctx)))<>1 then raise exception 'Booked slot visible';end if;
 if exists(select 1 from public.pt_sessions where member_id=(select mid1 from ctx)) then raise exception 'Other member data leaked'; end if;
 begin perform public.pt_book_slot((select slot1 from ctx));raise exception 'Double booking allowed';exception when raise_exception then if SQLERRM<>'이미 예약된 시간입니다. 다른 시간을 선택해 주세요.' then raise;end if;end;
end $$;
select set_config('request.jwt.claim.sub',(select admin::text from ctx),true);
do $$ declare sid uuid;begin
 select id into sid from public.pt_sessions where slot_id=(select slot1 from ctx);
 begin perform public.pt_set_session_status(sid,'completed');raise exception 'Future completion allowed';exception when raise_exception then if SQLERRM<>'시작 전 수업은 완료할 수 없습니다.' then raise;end if;end;
 perform public.pt_set_session_status(sid,'cancelled');
end $$;
select set_config('request.jwt.claim.sub',(select member2::text from ctx),true);
select public.pt_book_slot((select slot1 from ctx));
select set_config('request.jwt.claim.sub',(select admin::text from ctx),true);
select public.pt_save_simple_session(jsonb_build_object('id',past_session,'member_id',mid1,'session_date',current_date-1,'start_time','10:00','warm_up','Warm text','main','Main text','notes','Notes text')) from ctx;
do $$ begin
 perform public.pt_set_session_status((select past_session from ctx),'completed');
 perform public.pt_set_session_status((select past_session from ctx),'completed');
 if (select count(*) from public.pt_sessions where member_id=(select mid1 from ctx) and status='completed')<>1 then raise exception 'Completion deducted twice';end if;
 perform public.pt_set_session_status((select past_session from ctx),'scheduled');
 if exists(select 1 from public.pt_sessions where member_id=(select mid1 from ctx) and status='completed') then raise exception 'Undo did not restore balance';end if;
 perform public.pt_set_session_status((select past_session from ctx),'completed');
end $$;
select set_config('request.jwt.claim.sub',(select member1::text from ctx),true);
select public.pt_book_slot((select slot2 from ctx));
do $$ begin
 begin perform public.pt_book_slot((select slot1 from ctx));raise exception 'Over capacity booking allowed';exception when raise_exception then if SQLERRM<>'예약 가능한 잔여 횟수가 없습니다. 코치에게 문의해 주세요.' then raise;end if;end;
 if not exists(select 1 from public.pt_sessions where id=(select past_session from ctx) and warm_up='Warm text' and main='Main text' and notes='Notes text') then raise exception 'Simple log missing';end if;
end $$;
reset role;
select 'PASS: availability, booking, retry, collision, cancellation, completion, undo, capacity, log visibility and member authorization' result;
rollback;
