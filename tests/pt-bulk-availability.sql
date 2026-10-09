begin;
create temporary table bulk_test as select
 (select id from public.profiles where role in ('owner','admin') limit 1) admin,
 (select id from public.profiles where role='member' and id not in(select profile_id from public.pt_members) order by id limit 1) coach,
 (select id from public.profiles where role='member' and id not in(select profile_id from public.pt_members) order by id offset 1 limit 1) member,
 (date_trunc('week',current_date+14))::date first_day,
 gen_random_uuid() mid,gen_random_uuid() pack;
grant select on bulk_test to authenticated;
select set_config('request.jwt.claim.sub',(select admin::text from bulk_test),true);
set local role authenticated;
select public.register_pt_coach(coach) from bulk_test;
insert into public.pt_members(id,profile_id,coach_id) select mid,member,coach from bulk_test;
insert into public.pt_packages(id,member_id,title,total_sessions,starts_on) select pack,mid,'ROLLBACK TEST',10,current_date from bulk_test;
select set_config('request.jwt.claim.sub',(select coach::text from bulk_test),true);
insert into public.pt_availability_defaults(coach_id,weekday_start,weekday_end,weekend_enabled,weekend_start,weekend_end) select coach,'09:00','11:00',true,'10:00','12:00' from bulk_test;
select public.pt_apply_availability(coach,first_day,first_day+6,jsonb_build_object('weekday_enabled',true,'weekday_start','09:00','weekday_end','11:00','weekend_enabled',true,'weekend_start','10:00','weekend_end','12:00')) from bulk_test;
do $$ begin
 if (select count(*) from public.pt_slots where coach_id=(select coach from bulk_test) and is_open)<>14 then raise exception 'Weekly pattern failed';end if;
 if exists(select 1 from public.pt_slots where coach_id=(select coach from bulk_test) and extract(isodow from starts_at at time zone 'Asia/Seoul') in (6,7) and (starts_at at time zone 'Asia/Seoul')::time<'10:00') then raise exception 'Weekend pattern ignored';end if;
 begin perform public.pt_apply_availability((select admin from bulk_test),current_date,current_date,'{}');raise exception 'Coach changed other coach';exception when raise_exception then if SQLERRM<>'본인의 예약 가능 시간만 설정할 수 있습니다.' then raise;end if;end;
end $$;
select set_config('request.jwt.claim.sub',(select member::text from bulk_test),true);
select public.pt_book_slot((select id from public.pt_open_slots((select mid from bulk_test)) order by starts_at limit 1));
do $$ begin
 begin perform public.pt_apply_availability((select coach from bulk_test),current_date,current_date,'{}');raise exception 'Member changed slots';exception when raise_exception then if SQLERRM<>'본인의 예약 가능 시간만 설정할 수 있습니다.' then raise;end if;end;
 begin insert into public.pt_availability_defaults(coach_id) values(auth.uid());raise exception 'Member saved defaults';exception when insufficient_privilege then null;end;
end $$;
select set_config('request.jwt.claim.sub',(select coach::text from bulk_test),true);
-- Replace with shifted hours and weekends closed. The existing reservation must survive.
select public.pt_apply_availability(coach,first_day,first_day+6,jsonb_build_object('weekday_enabled',true,'weekday_start','09:30','weekday_end','11:30','weekend_enabled',false,'weekend_start','10:00','weekend_end','12:00')) from bulk_test;
do $$ declare before_count integer; begin
 if (select count(*) from public.pt_slots where coach_id=(select coach from bulk_test) and is_open)<>10 then raise exception 'Replacement failed';end if;
 if (select count(*) from public.pt_sessions where member_id=(select mid from bulk_test) and status='scheduled')<>1 then raise exception 'Reservation lost';end if;
 select count(*) into before_count from public.pt_slots where coach_id=(select coach from bulk_test);
 perform public.pt_apply_availability(coach,first_day,first_day+6,jsonb_build_object('weekday_enabled',true,'weekday_start','09:30','weekday_end','11:30','weekend_enabled',false,'weekend_start','10:00','weekend_end','12:00')) from bulk_test;
 if (select count(*) from public.pt_slots where coach_id=(select coach from bulk_test))<>before_count then raise exception 'Duplicate slots on retry';end if;
 begin perform public.pt_apply_availability(coach,first_day,first_day+6,jsonb_build_object('weekday_enabled',true,'weekday_start','11:00','weekday_end','09:00','weekend_enabled',false,'weekend_start','10:00','weekend_end','12:00')) from bulk_test;raise exception 'Invalid range accepted';exception when raise_exception then if SQLERRM<>'시간 범위를 60분 단위로 입력해 주세요.' then raise;end if;end;
end $$;
select set_config('request.jwt.claim.sub',(select member::text from bulk_test),true);
do $$ begin
 if exists(select 1 from public.pt_open_slots((select mid from bulk_test)) where (starts_at at time zone 'Asia/Seoul')::date=(select first_day from bulk_test) and (starts_at at time zone 'Asia/Seoul')::time='09:30') then raise exception 'Booked overlap exposed';end if;
end $$;
select set_config('request.jwt.claim.sub',(select coach::text from bulk_test),true);
do $$ declare first_month date:=(date_trunc('month',current_date)+interval '2 months')::date; last_month date:=(date_trunc('month',current_date)+interval '3 months'-interval '1 day')::date;expected integer;begin
 perform public.pt_apply_availability((select coach from bulk_test),first_month,last_month,jsonb_build_object('weekday_enabled',true,'weekday_start','09:00','weekday_end','10:00','weekend_enabled',false,'weekend_start','10:00','weekend_end','12:00'));
 select count(*) into expected from generate_series(first_month::timestamp,last_month::timestamp,interval '1 day') d where extract(isodow from d)<=5;
 if (select count(*) from public.pt_slots where coach_id=(select coach from bulk_test) and is_open and (starts_at at time zone 'Asia/Seoul')::date between first_month and last_month)<>expected then raise exception 'Month boundary or weekday count failed';end if;
end $$;
reset role;
select 'PASS: weekly/monthly patterns, saved defaults, scoped rights, shifted ranges, preserved bookings, idempotency and invalid ranges' result;
rollback;
