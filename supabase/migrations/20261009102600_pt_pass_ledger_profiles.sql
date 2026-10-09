-- Existing unlimited passes keep their original terms. New purchases have explicit terms.
alter table public.pt_packages add column purchased_on date;
-- Backfill only new metadata without invoking the old business-edit guard.
alter table public.pt_packages disable trigger pt_package_immutable;
update public.pt_packages set purchased_on=(created_at at time zone 'Asia/Seoul')::date;
alter table public.pt_packages enable trigger pt_package_immutable;
alter table public.pt_packages alter column purchased_on set default ((now() at time zone 'Asia/Seoul')::date);
alter table public.pt_packages alter column purchased_on set not null;
create table public.pt_pass_events (
 id bigint generated always as identity primary key,
 package_id uuid not null references public.pt_packages(id),
 session_id uuid references public.pt_sessions(id),
 actor_id uuid references public.profiles(id),
 kind text not null,
 delta integer not null default 0 check(delta between -1 and 1),
 details jsonb not null default '{}',
 created_at timestamptz not null default now()
);
create index pt_pass_events_package_idx on public.pt_pass_events(package_id,id);
create index pt_pass_events_session_idx on public.pt_pass_events(session_id);
create index pt_pass_events_actor_idx on public.pt_pass_events(actor_id);
alter table public.pt_pass_events enable row level security;
grant select,insert on public.pt_pass_events to authenticated;
grant usage on sequence public.pt_pass_events_id_seq to authenticated;
create policy pass_event_read on public.pt_pass_events for select to authenticated using(exists(select 1 from public.pt_packages p where p.id=package_id));
-- Writes are only allowed from internal trigger functions, never the client.
revoke insert on public.pt_pass_events from authenticated;
create function private.pt_record_pass_event() returns trigger language plpgsql security definer set search_path='' as $$
declare change integer:=0; event_kind text;
begin
 if auth.uid() is null then raise exception '로그인이 필요합니다.'; end if;
 if TG_TABLE_NAME='pt_packages' then
  if not public.is_ntac_admin() then raise exception '관리자 권한이 필요합니다.';end if;
  insert into public.pt_pass_events(package_id,actor_id,kind,details) values(new.id,auth.uid(),case when TG_OP='INSERT' then 'purchase' else 'terms_changed' end,jsonb_build_object('before',case when TG_OP='UPDATE' then to_jsonb(old) else null end,'after',to_jsonb(new),'reason',current_setting('ntac.pass_reason',true)));
 else
  if TG_OP='UPDATE' and row(new.status,new.session_date,new.start_time) is not distinct from row(old.status,old.session_date,old.start_time) then return new;end if;
  change:=case when new.status='completed' then -1 else 0 end - case when TG_OP='UPDATE' and old.status='completed' then -1 else 0 end;
  event_kind:=case when change=-1 then 'completed' when change=1 then 'restored' when new.status='cancelled' then 'cancelled' when TG_OP='UPDATE' then 'rescheduled' else 'reserved' end;
  insert into public.pt_pass_events(package_id,session_id,actor_id,kind,delta,details) values(new.package_id,new.id,auth.uid(),event_kind,change,jsonb_build_object('date',new.session_date,'time',new.start_time,'old_status',case when TG_OP='UPDATE' then old.status else null end,'status',new.status));
 end if;
 return new;
end $$;
revoke all on function private.pt_record_pass_event() from public,anon,authenticated;
create trigger pt_pass_purchase_audit after insert or update on public.pt_packages for each row execute function private.pt_record_pass_event();
create trigger pt_pass_session_audit after insert or update on public.pt_sessions for each row execute function private.pt_record_pass_event();
create or replace function public.pt_keep_package() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if not public.is_ntac_admin() then raise exception '이용권은 관리자만 수정할 수 있습니다.';end if;
 if new.id<>old.id or new.member_id<>old.member_id or new.created_at<>old.created_at then raise exception '이용권의 소유 정보는 변경할 수 없습니다.';end if;
 if nullif(current_setting('ntac.pass_reason',true),'') is null then raise exception '변경 사유를 입력해 주세요.';end if;
 if new.total_sessions<(select count(*) from public.pt_sessions where package_id=old.id and status<>'cancelled') then raise exception '사용·예약 횟수보다 적게 변경할 수 없습니다.';end if;
 if exists(select 1 from public.pt_sessions where package_id=old.id and status<>'cancelled' and (session_date<new.starts_on or (new.expires_on is not null and session_date>new.expires_on))) then raise exception '기존 수업이 이용 기간 밖으로 벗어납니다. 수업 일정을 먼저 확인해 주세요.';end if;
 return new;
end $$;
create function public.pt_save_package(payload jsonb) returns uuid language plpgsql security invoker set search_path='' as $$
declare pid uuid:=(payload->>'id')::uuid; existing public.pt_packages;
begin
 if auth.uid() is null or not public.is_ntac_admin() then raise exception '관리자 권한이 필요합니다.';end if;
 perform pg_advisory_xact_lock(hashtext(pid::text),92027);
 select * into existing from public.pt_packages where id=pid for update;
 if found then
  if existing.member_id<>(payload->>'member_id')::uuid then raise exception '회원이 일치하지 않습니다.';end if;
  -- A retry of purchase creation must not turn into an edit or duplicate purchase.
  if coalesce((payload->>'editing')::boolean,false)=false then return pid;end if;
  if char_length(trim(coalesce(payload->>'reason','')))<2 then raise exception '변경 사유를 입력해 주세요.';end if;
  perform set_config('ntac.pass_reason',trim(payload->>'reason'),true);
  update public.pt_packages set title=trim(payload->>'title'),total_sessions=(payload->>'total_sessions')::integer,purchased_on=(payload->>'purchased_on')::date,starts_on=(payload->>'starts_on')::date,expires_on=nullif(payload->>'expires_on','')::date where id=pid;
 else
  if coalesce((payload->>'editing')::boolean,false) then raise exception '이용권을 찾을 수 없습니다.';end if;
  insert into public.pt_packages(id,member_id,title,total_sessions,purchased_on,starts_on,expires_on) values(pid,(payload->>'member_id')::uuid,trim(payload->>'title'),(payload->>'total_sessions')::integer,(payload->>'purchased_on')::date,(payload->>'starts_on')::date,nullif(payload->>'expires_on','')::date);
 end if;
 return pid;
end $$;
revoke all on function public.pt_save_package(jsonb) from public,anon;
grant execute on function public.pt_save_package(jsonb) to authenticated;
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
 if new.status<>'cancelled' and (new.session_date<p.starts_on or (p.expires_on is not null and new.session_date>p.expires_on)) then raise exception '수업 날짜가 이용권 사용 기간 밖입니다.'; end if;
 if new.status<>'cancelled' then
  select count(*) into n from public.pt_sessions where package_id=p.id and status<>'cancelled' and id<>new.id;
  if n>=p.total_sessions then raise exception '예약 가능한 잔여 횟수가 없습니다.'; end if;
 end if;
 if new.status='completed' and (new.session_date+new.start_time) at time zone 'Asia/Seoul'>now() then raise exception '시작 전 수업은 완료할 수 없습니다.'; end if;
 new.updated_at=now(); return new;
end $$;

create or replace function private.pt_book_slot(slot uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare m public.pt_members; sl public.pt_slots; pid uuid; sid uuid;
begin
 if auth.uid() is null then raise exception '로그인이 필요합니다.'; end if;
 select * into m from public.pt_members where profile_id=auth.uid() and active for update;
 if not found then raise exception 'PT 등록이 필요합니다.'; end if;
 select * into sl from public.pt_slots where id=slot for update;
 if not found or sl.coach_id is distinct from m.coach_id or not sl.is_open or sl.starts_at<=now() then raise exception '예약 가능한 시간이 아닙니다.'; end if;
 select id into sid from public.pt_sessions where slot_id=slot and member_id=m.id and status='scheduled';
 if found then return sid; end if;
 select p.id into pid from public.pt_packages p where p.member_id=m.id and p.starts_on<=(sl.starts_at at time zone 'Asia/Seoul')::date and (p.expires_on is null or p.expires_on>=(sl.starts_at at time zone 'Asia/Seoul')::date) and p.total_sessions>(select count(*) from public.pt_sessions s where s.package_id=p.id and s.status<>'cancelled') order by p.starts_on,p.created_at limit 1 for update;
 if pid is null then raise exception '예약 가능한 잔여 횟수가 없습니다. 코치에게 문의해 주세요.'; end if;
 insert into public.pt_sessions(member_id,package_id,session_date,start_time,title,status,workout,slot_id,duration_minutes) values(m.id,pid,(sl.starts_at at time zone 'Asia/Seoul')::date,(sl.starts_at at time zone 'Asia/Seoul')::time,'PT','scheduled','[]',sl.id,extract(epoch from sl.ends_at-sl.starts_at)/60) returning id into sid;
 return sid;
exception when exclusion_violation or unique_violation then raise exception '이미 예약된 시간입니다. 다른 시간을 선택해 주세요.';
end $$;
create or replace function public.pt_book_slot(slot uuid) returns uuid language sql security invoker set search_path='' as $$ select private.pt_book_slot(slot); $$;
create or replace function public.pt_save_simple_session(payload jsonb) returns uuid language plpgsql security invoker set search_path='' as $$
declare sid uuid:=coalesce((payload->>'id')::uuid,gen_random_uuid()); mid uuid:=(payload->>'member_id')::uuid; pid uuid;
begin
 if auth.uid() is null or not private.pt_can_manage(mid) then raise exception '담당 코치 권한이 필요합니다.'; end if;
 if exists(select 1 from public.pt_sessions where id=sid and member_id=mid) then
  update public.pt_sessions set warm_up=coalesce(payload->>'warm_up',''),main=coalesce(payload->>'main',''),notes=coalesce(payload->>'notes','') where id=sid;
 else
  select p.id into pid from public.pt_packages p where member_id=mid and starts_on<=(payload->>'session_date')::date and (expires_on is null or expires_on>=(payload->>'session_date')::date) and total_sessions>(select count(*) from public.pt_sessions s where s.package_id=p.id and s.status<>'cancelled') order by starts_on,created_at limit 1;
  if pid is null then raise exception '예약 가능한 이용권이 없습니다.'; end if;
  insert into public.pt_sessions(id,member_id,package_id,session_date,start_time,title,status,workout,warm_up,main,notes) values(sid,mid,pid,(payload->>'session_date')::date,(payload->>'start_time')::time,'PT','scheduled','[]',coalesce(payload->>'warm_up',''),coalesce(payload->>'main',''),coalesce(payload->>'notes',''));
 end if;
 return sid;
exception when exclusion_violation then raise exception '회원 또는 코치의 다른 수업과 시간이 겹칩니다.';
end $$;

-- Profile fields are explicitly allowlisted. Role, entitlements and login email are never accepted.
create function private.ntac_save_profile(target_id uuid,payload jsonb) returns void language plpgsql security definer set search_path='' as $$
declare n text:=trim(payload->>'full_name'); ph text:=regexp_replace(coalesce(payload->>'phone',''),'[^0-9]','','g'); birthday date:=nullif(payload->>'birth_date','')::date;
begin
 if auth.uid() is null or (target_id<>auth.uid() and not public.is_ntac_admin()) then raise exception '프로필 수정 권한이 없습니다.';end if;
 if n is null or char_length(n)<2 or char_length(n)>80 then raise exception '이름은 2~80자로 입력해 주세요.';end if;
 if ph<>'' and ph !~ '^[0-9]{10,11}$' then raise exception '연락처를 확인해 주세요.';end if;
 if birthday is not null and (birthday>(now() at time zone 'Asia/Seoul')::date or birthday<current_date-interval '120 years') then raise exception '생년월일을 확인해 주세요.';end if;
 if char_length(coalesce(payload->>'training_goal',''))>1000 or char_length(coalesce(payload->>'training_experience',''))>1000 then raise exception '운동 정보는 1,000자 이내로 입력해 주세요.';end if;
 update public.profiles set full_name=n,phone=nullif(ph,''),sex=nullif(payload->>'sex',''),birth_date=birthday,training_goal=coalesce(payload->>'training_goal',''),training_experience=coalesce(payload->>'training_experience','') where id=target_id;
 if not found then raise exception '프로필을 찾을 수 없습니다.';end if;
end $$;
create function public.ntac_save_profile(target_id uuid,payload jsonb) returns void language sql security invoker set search_path='' as $$ select private.ntac_save_profile(target_id,payload); $$;
revoke all on function private.ntac_save_profile(uuid,jsonb),public.ntac_save_profile(uuid,jsonb) from public,anon;
grant execute on function private.ntac_save_profile(uuid,jsonb),public.ntac_save_profile(uuid,jsonb) to authenticated;
