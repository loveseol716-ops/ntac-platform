create table public.pt_availability_defaults (
 coach_id uuid primary key references public.profiles(id),
 weekday_enabled boolean not null default true,
 weekday_start time not null default '09:00',weekday_end time not null default '18:00',
 weekend_enabled boolean not null default false,
 weekend_start time not null default '09:00',weekend_end time not null default '13:00',
 check(not weekday_enabled or (weekday_end>weekday_start and mod(extract(epoch from weekday_end-weekday_start)::numeric,3600)=0)),
 check(not weekend_enabled or (weekend_end>weekend_start and mod(extract(epoch from weekend_end-weekend_start)::numeric,3600)=0))
);
alter table public.pt_availability_defaults enable row level security;
grant select,insert,update on public.pt_availability_defaults to authenticated;
create policy pt_defaults_read on public.pt_availability_defaults for select to authenticated using(public.is_ntac_admin() or (coach_id=(select auth.uid()) and private.pt_is_coach()));
create policy pt_defaults_insert on public.pt_availability_defaults for insert to authenticated with check(public.is_ntac_admin() or (coach_id=(select auth.uid()) and private.pt_is_coach()));
create policy pt_defaults_update on public.pt_availability_defaults for update to authenticated using(public.is_ntac_admin() or (coach_id=(select auth.uid()) and private.pt_is_coach())) with check(public.is_ntac_admin() or (coach_id=(select auth.uid()) and private.pt_is_coach()));
-- Closed windows can be replaced with shifted times without deleting booking history.
alter table public.pt_slots drop constraint pt_slots_coach_id_tstzrange_excl;
alter table public.pt_slots add constraint pt_open_slots_no_overlap exclude using gist(coach_id with =,tstzrange(starts_at,ends_at,'[)') with &&) where (is_open);
create function public.pt_apply_availability(target_coach uuid,first_day date,last_day date,settings jsonb) returns jsonb language plpgsql security invoker set search_path='' as $$
declare cfg public.pt_availability_defaults; d date; a time; b time; enabled boolean; stamp timestamptz; finish timestamptz; existing uuid; opened integer:=0;
begin
 if auth.uid() is null or not(public.is_ntac_admin() or (target_coach=auth.uid() and private.pt_is_coach())) then raise exception '본인의 예약 가능 시간만 설정할 수 있습니다.';end if;
 if not exists(select 1 from public.profiles where id=target_coach and role in ('owner','admin','coach')) then raise exception '코치 계정이 필요합니다.';end if;
 if first_day is null or last_day is null or last_day<first_day or last_day-first_day>62 then raise exception '설정 기간은 최대 63일입니다.';end if;
 select * into cfg from jsonb_populate_record(null::public.pt_availability_defaults,settings);
 if cfg.weekday_enabled is null or cfg.weekend_enabled is null or cfg.weekday_start is null or cfg.weekday_end is null or cfg.weekend_start is null or cfg.weekend_end is null then raise exception '평일·주말 시간을 입력해 주세요.';end if;
 if (cfg.weekday_enabled and (cfg.weekday_end<=cfg.weekday_start or mod(extract(epoch from cfg.weekday_end-cfg.weekday_start)::numeric,3600)<>0)) or (cfg.weekend_enabled and (cfg.weekend_end<=cfg.weekend_start or mod(extract(epoch from cfg.weekend_end-cfg.weekend_start)::numeric,3600)<>0)) then raise exception '시간 범위를 60분 단위로 입력해 주세요.';end if;
 perform pg_advisory_xact_lock(hashtextextended(target_coach::text,92026));
 update public.pt_slots set is_open=false where coach_id=target_coach and is_open and starts_at>now() and starts_at>=first_day::timestamp at time zone 'Asia/Seoul' and starts_at<(last_day+1)::timestamp at time zone 'Asia/Seoul';
 d:=first_day;
 while d<=last_day loop
  if extract(isodow from d)<=5 then a:=cfg.weekday_start;b:=cfg.weekday_end;enabled:=cfg.weekday_enabled;
  else a:=cfg.weekend_start;b:=cfg.weekend_end;enabled:=cfg.weekend_enabled;end if;
  if enabled then
   stamp:=(d+a) at time zone 'Asia/Seoul';finish:=(d+b) at time zone 'Asia/Seoul';
   while stamp+interval '1 hour'<=finish loop
    if stamp>now() then
     select id into existing from public.pt_slots where coach_id=target_coach and starts_at=stamp and ends_at=stamp+interval '1 hour' order by created_at desc limit 1;
     if found then update public.pt_slots set is_open=true where id=existing;
     else insert into public.pt_slots(coach_id,starts_at,ends_at) values(target_coach,stamp,stamp+interval '1 hour');end if;
     opened:=opened+1;
    end if;
    stamp:=stamp+interval '1 hour';
   end loop;
  end if;
  d:=d+1;
 end loop;
 return jsonb_build_object('opened',opened,'first_day',first_day,'last_day',last_day);
end $$;
revoke all on function public.pt_apply_availability(uuid,date,date,jsonb) from public,anon;
grant execute on function public.pt_apply_availability(uuid,date,date,jsonb) to authenticated;
