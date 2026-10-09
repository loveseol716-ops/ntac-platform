create extension if not exists btree_gist with schema extensions;
create table public.pt_slots (
 id uuid primary key default gen_random_uuid(),
 coach_id uuid not null references public.profiles(id),
 starts_at timestamptz not null,
 ends_at timestamptz not null,
 is_open boolean not null default true,
 created_at timestamptz not null default now(),
 check(ends_at>starts_at and ends_at<=starts_at+interval '3 hours'),
 exclude using gist(coach_id with =,tstzrange(starts_at,ends_at,'[)') with &&)
);
alter table public.pt_slots enable row level security;
grant select,insert,update on public.pt_slots to authenticated;
create policy pt_slots_staff_read on public.pt_slots for select to authenticated using(public.is_ntac_admin() or (coach_id=(select auth.uid()) and private.pt_is_coach()));
create policy pt_slots_staff_insert on public.pt_slots for insert to authenticated with check(public.is_ntac_admin() or (coach_id=(select auth.uid()) and private.pt_is_coach()));
create policy pt_slots_staff_update on public.pt_slots for update to authenticated using(public.is_ntac_admin() or (coach_id=(select auth.uid()) and private.pt_is_coach())) with check(public.is_ntac_admin() or (coach_id=(select auth.uid()) and private.pt_is_coach()));
create function public.pt_guard_slot() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if not exists(select 1 from public.profiles where id=new.coach_id and role in ('admin','owner','coach')) then raise exception '코치 계정이 필요합니다.'; end if;
 if TG_OP='UPDATE' and (new.coach_id<>old.coach_id or new.starts_at<>old.starts_at or new.ends_at<>old.ends_at) then raise exception '시간 변경은 기존 시간을 닫고 새로 열어주세요.'; end if;
 return new;
end $$;
create trigger pt_guard_slot before insert or update on public.pt_slots for each row execute function public.pt_guard_slot();
alter table public.pt_sessions add column warm_up text not null default '';
alter table public.pt_sessions add column main text not null default '';
alter table public.pt_sessions add column notes text not null default '';
alter table public.pt_sessions add column coach_id uuid references public.profiles(id);
alter table public.pt_sessions add column duration_minutes integer not null default 60 check(duration_minutes between 15 and 180);
alter table public.pt_sessions add column slot_id uuid references public.pt_slots(id);
-- Existing structured records remain intact; render them as plain text going forward.
alter table public.pt_sessions disable trigger pt_validate_session;
update public.pt_sessions s set
 coach_id=m.coach_id,
 warm_up=coalesce((select string_agg(concat_ws(' · ',w->>'name',w->>'target',nullif(w->>'condition','')),E'\n') from jsonb_array_elements(s.workout) w where lower(w->>'block') like 'warm%'),''),
 main=coalesce((select string_agg(concat_ws(' · ',w->>'block',w->>'name',w->>'target',nullif(w->>'condition','')),E'\n') from jsonb_array_elements(s.workout) w where lower(coalesce(w->>'block','')) not like 'warm%'),''),
 notes=concat_ws(E'\n',nullif(s.feedback,''),nullif(s.homework,''))
from public.pt_members m where m.id=s.member_id;
alter table public.pt_sessions enable trigger pt_validate_session;
-- Constraints protect against concurrent bookings, including overlapping manual sessions.
alter table public.pt_sessions add constraint pt_no_coach_overlap exclude using gist (coach_id with =,tsrange(session_date+start_time,session_date+start_time+duration_minutes*interval '1 minute','[)') with &&) where (status<>'cancelled');
alter table public.pt_sessions add constraint pt_no_member_overlap exclude using gist (member_id with =,tsrange(session_date+start_time,session_date+start_time+duration_minutes*interval '1 minute','[)') with &&) where (status<>'cancelled');
create unique index pt_active_slot on public.pt_sessions(slot_id) where status<>'cancelled';
create index pt_sessions_coach_day on public.pt_sessions(coach_id,session_date);
create or replace function public.pt_validate_session() returns trigger language plpgsql security invoker set search_path='' as $$
declare p public.pt_packages; m public.pt_members; sl public.pt_slots; n integer; managing boolean;
begin
 if auth.uid() is null then raise exception '로그인이 필요합니다.'; end if;
 select * into m from public.pt_members where id=new.member_id;
 managing:=private.pt_can_manage(new.member_id);
 if not managing then
  if TG_OP<>'INSERT' or m.profile_id<>auth.uid() or not m.active or new.slot_id is null or new.status<>'scheduled' or new.warm_up<>'' or new.main<>'' or new.notes<>'' then raise exception '코치만 수업을 변경할 수 있습니다.'; end if;
 end if;
 if TG_OP='UPDATE' and (new.member_id<>old.member_id or new.package_id<>old.package_id) then raise exception '저장된 수업의 회원과 이용권은 변경할 수 없습니다.'; end if;
 if TG_OP='INSERT' then new.coach_id:=m.coach_id; end if;
 if new.coach_id is null and new.status<>'cancelled' then raise exception '담당 코치를 먼저 배정해 주세요.'; end if;
 if new.slot_id is not null then
  select * into sl from public.pt_slots where id=new.slot_id for update;
  if not found or sl.coach_id<>new.coach_id or (new.session_date+new.start_time) at time zone 'Asia/Seoul'<>sl.starts_at or new.duration_minutes<>extract(epoch from sl.ends_at-sl.starts_at)/60 then raise exception '예약 시간과 수업 시간이 일치하지 않습니다.'; end if;
  if TG_OP='INSERT' and (not sl.is_open or sl.starts_at<=now()) then raise exception '예약 가능한 시간이 아닙니다.'; end if;
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
-- Narrow private RPCs bridge member booking to staff-owned records. No direct member writes are granted.
create function private.pt_open_slots(mid uuid) returns table(id uuid,starts_at timestamptz,ends_at timestamptz) language plpgsql stable security definer set search_path='' as $$
declare m public.pt_members;
begin
 select * into m from public.pt_members where pt_members.id=mid;
 if auth.uid() is null or not m.active or m.profile_id<>auth.uid() then raise exception '본인의 예약 가능 시간만 확인할 수 있습니다.'; end if;
 return query select sl.id,sl.starts_at,sl.ends_at from public.pt_slots sl where sl.coach_id=m.coach_id and sl.is_open and sl.starts_at>now()
 and not exists(select 1 from public.pt_sessions s where s.status<>'cancelled' and (s.coach_id=m.coach_id or s.member_id=mid) and tstzrange((s.session_date+s.start_time) at time zone 'Asia/Seoul',(s.session_date+s.start_time+s.duration_minutes*interval '1 minute') at time zone 'Asia/Seoul','[)') && tstzrange(sl.starts_at,sl.ends_at,'[)')) order by sl.starts_at;
end $$;
create function public.pt_open_slots(mid uuid) returns table(id uuid,starts_at timestamptz,ends_at timestamptz) language sql security invoker set search_path='' as $$ select * from private.pt_open_slots(mid); $$;
create function private.pt_book_slot(slot uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare m public.pt_members; sl public.pt_slots; pid uuid; sid uuid;
begin
 if auth.uid() is null then raise exception '로그인이 필요합니다.'; end if;
 select * into m from public.pt_members where profile_id=auth.uid() and active for update;
 if not found then raise exception 'PT 등록이 필요합니다.'; end if;
 select * into sl from public.pt_slots where id=slot for update;
 if not found or sl.coach_id is distinct from m.coach_id or not sl.is_open or sl.starts_at<=now() then raise exception '예약 가능한 시간이 아닙니다.'; end if;
 select id into sid from public.pt_sessions where slot_id=slot and member_id=m.id and status='scheduled';
 if found then return sid; end if;
 select p.id into pid from public.pt_packages p where p.member_id=m.id and p.starts_on<=(sl.starts_at at time zone 'Asia/Seoul')::date and p.total_sessions>(select count(*) from public.pt_sessions s where s.package_id=p.id and s.status<>'cancelled') order by p.starts_on,p.created_at limit 1 for update;
 if pid is null then raise exception '예약 가능한 잔여 횟수가 없습니다. 코치에게 문의해 주세요.'; end if;
 insert into public.pt_sessions(member_id,package_id,session_date,start_time,title,status,workout,slot_id,duration_minutes) values(m.id,pid,(sl.starts_at at time zone 'Asia/Seoul')::date,(sl.starts_at at time zone 'Asia/Seoul')::time,'PT','scheduled','[]',sl.id,extract(epoch from sl.ends_at-sl.starts_at)/60) returning id into sid;
 return sid;
exception when exclusion_violation or unique_violation then raise exception '이미 예약된 시간입니다. 다른 시간을 선택해 주세요.';
end $$;
create function public.pt_book_slot(slot uuid) returns uuid language sql security invoker set search_path='' as $$ select private.pt_book_slot(slot); $$;
create function public.pt_save_simple_session(payload jsonb) returns uuid language plpgsql security invoker set search_path='' as $$
declare sid uuid:=coalesce((payload->>'id')::uuid,gen_random_uuid()); mid uuid:=(payload->>'member_id')::uuid; pid uuid;
begin
 if auth.uid() is null or not private.pt_can_manage(mid) then raise exception '담당 코치 권한이 필요합니다.'; end if;
 if exists(select 1 from public.pt_sessions where id=sid and member_id=mid) then
  update public.pt_sessions set warm_up=coalesce(payload->>'warm_up',''),main=coalesce(payload->>'main',''),notes=coalesce(payload->>'notes','') where id=sid;
 else
  select p.id into pid from public.pt_packages p where member_id=mid and starts_on<=(payload->>'session_date')::date and total_sessions>(select count(*) from public.pt_sessions s where s.package_id=p.id and s.status<>'cancelled') order by starts_on,created_at limit 1;
  if pid is null then raise exception '예약 가능한 이용권이 없습니다.'; end if;
  insert into public.pt_sessions(id,member_id,package_id,session_date,start_time,title,status,workout,warm_up,main,notes) values(sid,mid,pid,(payload->>'session_date')::date,(payload->>'start_time')::time,'PT','scheduled','[]',coalesce(payload->>'warm_up',''),coalesce(payload->>'main',''),coalesce(payload->>'notes',''));
 end if;
 return sid;
exception when exclusion_violation then raise exception '회원 또는 코치의 다른 수업과 시간이 겹칩니다.';
end $$;
create function public.pt_set_session_status(sid uuid,new_status text) returns void language plpgsql security invoker set search_path='' as $$
declare s public.pt_sessions;
begin
 select * into s from public.pt_sessions where id=sid for update;
 if not found or not private.pt_can_manage(s.member_id) then raise exception '담당 코치 권한이 필요합니다.'; end if;
 if new_status not in ('completed','cancelled','scheduled') then raise exception '잘못된 상태입니다.'; end if;
 update public.pt_sessions set status=new_status where id=sid;
end $$;
revoke all on function private.pt_open_slots(uuid),private.pt_book_slot(uuid),public.pt_open_slots(uuid),public.pt_book_slot(uuid),public.pt_save_simple_session(jsonb),public.pt_set_session_status(uuid,text) from public,anon;
grant execute on function private.pt_open_slots(uuid),private.pt_book_slot(uuid),public.pt_open_slots(uuid),public.pt_book_slot(uuid),public.pt_save_simple_session(jsonb),public.pt_set_session_status(uuid,text) to authenticated;
