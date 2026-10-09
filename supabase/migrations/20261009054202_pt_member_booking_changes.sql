create or replace function public.pt_validate_session() returns trigger language plpgsql security invoker set search_path='' as $$
declare p public.pt_packages; m public.pt_members; sl public.pt_slots; n integer; managing boolean;
begin
 if auth.uid() is null then raise exception '로그인이 필요합니다.'; end if;
 select * into m from public.pt_members where id=new.member_id;
 managing:=private.pt_can_manage(new.member_id);
 if not managing then
  if m.profile_id is distinct from auth.uid() or not coalesce(m.active,false) then raise exception '본인의 예약만 변경할 수 있습니다.'; end if;
  if TG_OP='INSERT' then
   if new.slot_id is null or new.status<>'scheduled' or new.warm_up<>'' or new.main<>'' or new.notes<>'' then raise exception '코치만 운동 내용을 작성할 수 있습니다.'; end if;
  else
   if old.status<>'scheduled' or new.status not in ('scheduled','cancelled') then raise exception '예약된 수업만 변경할 수 있습니다.'; end if;
   if (old.session_date+old.start_time) at time zone 'Asia/Seoul'<=now()+interval '1 hour' then raise exception '수업 시작 1시간 이내에는 담당 코치에게 문의해 주세요.'; end if;
   if (to_jsonb(new)-array['session_date','start_time','slot_id','duration_minutes','coach_id','status','updated_at']) is distinct from (to_jsonb(old)-array['session_date','start_time','slot_id','duration_minutes','coach_id','status','updated_at']) then raise exception '회원은 예약 시간과 취소만 변경할 수 있습니다.'; end if;
   if new.status='cancelled' then
    if row(new.session_date,new.start_time,new.slot_id,new.duration_minutes,new.coach_id) is distinct from row(old.session_date,old.start_time,old.slot_id,old.duration_minutes,old.coach_id) then raise exception '취소 시 수업 시간을 변경할 수 없습니다.'; end if;
   elsif new.slot_id is null or new.coach_id is distinct from m.coach_id then raise exception '담당 코치의 예약 가능 시간을 선택해 주세요.';
   end if;
  end if;
 end if;
 if TG_OP='UPDATE' and (new.member_id<>old.member_id or new.package_id<>old.package_id) then raise exception '저장된 수업의 회원과 이용권은 변경할 수 없습니다.'; end if;
 if TG_OP='INSERT' then new.coach_id:=m.coach_id; end if;
 if new.coach_id is null and new.status<>'cancelled' then raise exception '담당 코치를 먼저 배정해 주세요.'; end if;
 if new.slot_id is not null then
  select * into sl from public.pt_slots where id=new.slot_id for update;
  if not found or sl.coach_id<>new.coach_id or (new.session_date+new.start_time) at time zone 'Asia/Seoul'<>sl.starts_at or new.duration_minutes<>extract(epoch from sl.ends_at-sl.starts_at)/60 then raise exception '예약 시간과 수업 시간이 일치하지 않습니다.'; end if;
  if (TG_OP='INSERT' or (not managing and new.status='scheduled')) and (not sl.is_open or sl.starts_at<=now()) then raise exception '예약 가능한 시간이 아닙니다.'; end if;
 end if;
 select * into p from public.pt_packages where id=new.package_id for update;
 if not found or p.member_id<>new.member_id then raise exception '이용권을 찾을 수 없습니다.'; end if;
 if new.status<>'cancelled' and new.session_date<p.starts_on then raise exception '수업 날짜가 등록일 이전입니다.'; end if;
 if new.status<>'cancelled' then
  select count(*) into n from public.pt_sessions where package_id=p.id and status<>'cancelled' and id<>new.id;
  if n>=p.total_sessions then raise exception '예약 가능한 잔여 횟수가 없습니다.'; end if;
 end if;
 if new.status='completed' and (new.session_date+new.start_time) at time zone 'Asia/Seoul'>now() then raise exception '시작 전 수업은 완료할 수 없습니다.'; end if;
 new.updated_at=now(); return new;
end $$;

-- The public wrapper retains invoker rights. Only this narrow private function can
-- update a member's reservation; direct member UPDATE access remains denied.
create function private.pt_change_booking(sid uuid, target_slot uuid default null) returns uuid
language plpgsql security definer set search_path='' as $$
declare m public.pt_members; s public.pt_sessions; sl public.pt_slots;
begin
 if auth.uid() is null then raise exception '로그인이 필요합니다.'; end if;
 select * into m from public.pt_members where profile_id=auth.uid() and active for update;
 if not found then raise exception 'PT 등록이 필요합니다.'; end if;
 select * into s from public.pt_sessions where id=sid and member_id=m.id for update;
 if not found then raise exception '본인의 예약만 변경할 수 있습니다.'; end if;
 if s.status<>'scheduled' then raise exception '예약된 수업만 변경할 수 있습니다.'; end if;
 if (s.session_date+s.start_time) at time zone 'Asia/Seoul'<=now()+interval '1 hour' then raise exception '수업 시작 1시간 이내에는 담당 코치에게 문의해 주세요.'; end if;
 if target_slot is null then
  update public.pt_sessions set status='cancelled' where id=sid;
 else
  select * into sl from public.pt_slots where id=target_slot for update;
  if not found or sl.coach_id is distinct from m.coach_id or not sl.is_open or sl.starts_at<=now() then raise exception '예약 가능한 시간이 아닙니다.'; end if;
  update public.pt_sessions set slot_id=sl.id,coach_id=sl.coach_id,
   session_date=(sl.starts_at at time zone 'Asia/Seoul')::date,
   start_time=(sl.starts_at at time zone 'Asia/Seoul')::time,
   duration_minutes=extract(epoch from sl.ends_at-sl.starts_at)/60 where id=sid;
 end if;
 return sid;
exception when exclusion_violation or unique_violation then raise exception '이미 예약된 시간입니다. 기존 예약은 유지됩니다.';
end $$;
create function public.pt_change_booking(sid uuid,target_slot uuid default null) returns uuid
language sql security invoker set search_path='' as $$ select private.pt_change_booking(sid,target_slot); $$;
revoke all on function private.pt_change_booking(uuid,uuid),public.pt_change_booking(uuid,uuid) from public,anon;
grant execute on function private.pt_change_booking(uuid,uuid),public.pt_change_booking(uuid,uuid) to authenticated;
