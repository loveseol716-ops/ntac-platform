begin;
create temporary table pass_test as select
(select id from public.profiles where role in ('owner','admin') limit 1) admin,
(select id from public.profiles where role='member' and id not in(select profile_id from public.pt_members) order by id limit 1) member,
(select id from public.profiles where role='member' and id not in(select profile_id from public.pt_members) order by id offset 1 limit 1) stranger,
gen_random_uuid() mid,gen_random_uuid() first_pass,gen_random_uuid() second_pass,
(now() at time zone 'Asia/Seoul')::date test_day;
grant select on pass_test to authenticated;
select set_config('request.jwt.claim.sub',(select admin::text from pass_test),true);
set local role authenticated;
insert into public.pt_members(id,profile_id,coach_id) select mid,member,admin from pass_test;
select public.pt_save_package(jsonb_build_object('id',first_pass,'member_id',mid,'title','First purchase','total_sessions',2,'purchased_on',test_day-10,'starts_on',test_day-10,'expires_on',test_day-2)) from pass_test;
select public.pt_save_package(jsonb_build_object('id',first_pass,'member_id',mid,'title','First purchase','total_sessions',2,'purchased_on',test_day-10,'starts_on',test_day-10,'expires_on',test_day-2)) from pass_test;
do $$ declare sid uuid; begin
 if (select count(*) from public.pt_pass_events where package_id=(select first_pass from pass_test) and kind='purchase')<>1 then raise exception 'Duplicate purchase';end if;
 for i in 1..2 loop
  sid:=public.pt_save_simple_session(jsonb_build_object('member_id',(select mid from pass_test),'session_date',(select test_day-6+i from pass_test),'start_time','09:00'));
  perform public.pt_set_session_status(sid,'completed');
  perform public.pt_set_session_status(sid,'completed');
 end loop;
 if (select sum(delta) from public.pt_pass_events where package_id=(select first_pass from pass_test))<>-2 then raise exception 'Double deduction';end if;
 begin perform public.pt_save_simple_session(jsonb_build_object('member_id',(select mid from pass_test),'session_date',(select test_day-3 from pass_test),'start_time','09:00'));raise exception 'Overuse allowed';exception when raise_exception then if SQLERRM<>'예약 가능한 이용권이 없습니다.' then raise;end if;end;
end $$;
select public.pt_save_package(jsonb_build_object('id',second_pass,'member_id',mid,'title','Renewal','total_sessions',2,'purchased_on',test_day-1,'starts_on',test_day-1,'expires_on',test_day+30)) from pass_test;
do $$ declare sid uuid; payload jsonb;begin
 sid:=public.pt_save_simple_session(jsonb_build_object('member_id',(select mid from pass_test),'session_date',(select test_day-1 from pass_test),'start_time','09:00'));
 if (select package_id from public.pt_sessions where id=sid)<>(select second_pass from pass_test) then raise exception 'Wrong renewal allocation';end if;
 perform public.pt_set_session_status(sid,'completed');
 perform public.pt_set_session_status(sid,'scheduled');
 perform public.pt_set_session_status(sid,'completed');
 if (select sum(delta) from public.pt_pass_events where package_id=(select second_pass from pass_test))<>-1 then raise exception 'Restore mismatch';end if;
 perform public.pt_save_simple_session(jsonb_build_object('member_id',(select mid from pass_test),'session_date',(select test_day+2 from pass_test),'start_time','09:00'));
 begin perform public.pt_save_simple_session(jsonb_build_object('member_id',(select mid from pass_test),'session_date',(select test_day+31 from pass_test),'start_time','09:00'));raise exception 'Expired pass allowed';exception when raise_exception then if SQLERRM<>'예약 가능한 이용권이 없습니다.' then raise;end if;end;
 select jsonb_build_object('id',second_pass,'member_id',mid,'title','Renewal','total_sessions',1,'purchased_on',test_day-1,'starts_on',test_day-1,'expires_on',test_day+30,'editing',true,'reason','Correction') into payload from pass_test;
 begin perform public.pt_save_package(payload);raise exception 'Capacity reduced under reservations';exception when raise_exception then if SQLERRM<>'사용·예약 횟수보다 적게 변경할 수 없습니다.' then raise;end if;end;
 payload:=jsonb_set(payload,'{total_sessions}','2');payload:=jsonb_set(payload,'{expires_on}',to_jsonb((select test_day from pass_test)));
 begin perform public.pt_save_package(payload);raise exception 'Dates exclude reservation';exception when raise_exception then if SQLERRM<>'기존 수업이 이용 기간 밖으로 벗어납니다. 수업 일정을 먼저 확인해 주세요.' then raise;end if;end;
 payload:=jsonb_set(payload,'{expires_on}',to_jsonb((select test_day+60 from pass_test)));perform public.pt_save_package(payload);
 if not exists(select 1 from public.pt_pass_events where package_id=(select second_pass from pass_test) and kind='terms_changed' and details->>'reason'='Correction') then raise exception 'Terms audit missing';end if;
end $$;
select set_config('request.jwt.claim.sub',(select member::text from pass_test),true);
select public.ntac_save_profile(member,jsonb_build_object('full_name','본인 테스트','phone','01012345678','training_goal','기초 체력','role','owner','ntac_enabled',true)) from pass_test;
do $$ begin
 if (select role from public.profiles where id=auth.uid())<>'member' then raise exception 'Profile escalated role';end if;
 if (select count(*) from public.pt_pass_events where package_id=(select first_pass from pass_test))=0 then raise exception 'Member cannot read own ledger';end if;
 begin perform public.ntac_save_profile((select stranger from pass_test),'{"full_name":"다른 사람"}');raise exception 'Other profile editable';exception when raise_exception then if SQLERRM<>'프로필 수정 권한이 없습니다.' then raise;end if;end;
 begin insert into public.pt_pass_events(package_id,kind) values((select first_pass from pass_test),'completed');raise exception 'Member forged ledger';exception when insufficient_privilege then null;end;
 begin perform public.pt_save_package('{}');raise exception 'Member issued pass';exception when raise_exception then if SQLERRM<>'관리자 권한이 필요합니다.' then raise;end if;end;
end $$;
select set_config('request.jwt.claim.sub',(select stranger::text from pass_test),true);
do $$ begin if exists(select 1 from public.pt_pass_events where package_id=(select first_pass from pass_test)) then raise exception 'Unrelated member read ledger';end if;end $$;
reset role;
select 'PASS: idempotent purchase, exact deductions/restores, renewal allocation, expiry, reserved capacity, terms audit, profile and ledger isolation' result;
rollback;
