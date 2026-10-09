-- PT entitlement is independent of the existing NTAC membership.
alter table public.profiles drop constraint profiles_membership_check;
alter table public.profiles add constraint profiles_membership_check check (membership in ('NTAC RUN','NTAC BUILD','NTAC COMPLETE','NTAC ATHLETE','NTAC COMMUNITY','TRIAL','PT'));
create table public.pt_members (
 id uuid primary key default gen_random_uuid(), profile_id uuid not null unique references public.profiles(id),
 goal text not null default '', experience text not null default '', created_at timestamptz not null default now()
);
create table public.pt_packages (
 id uuid primary key default gen_random_uuid(), member_id uuid not null references public.pt_members(id),
 title text not null check(length(trim(title))>0), total_sessions integer not null check(total_sessions between 1 and 1000),
 starts_on date not null, expires_on date, created_at timestamptz not null default now(),
 unique(id,member_id), check(expires_on is null or expires_on>=starts_on)
);
create table public.pt_sessions (
 id uuid primary key default gen_random_uuid(), member_id uuid not null references public.pt_members(id),
 package_id uuid not null, session_date date not null, start_time time not null default '10:00',
 title text not null check(length(trim(title))>0), status text not null default 'scheduled' check(status in ('scheduled','completed','cancelled')),
 workout jsonb not null default '[]' check(jsonb_typeof(workout)='array'), feedback text not null default '', homework text not null default '',
 session_rpe numeric check(session_rpe between 0 and 10), updated_at timestamptz not null default now(),
 created_at timestamptz not null default now(), unique(id,member_id),
 foreign key(package_id,member_id) references public.pt_packages(id,member_id)
);
create table public.pt_session_private (
 session_id uuid primary key, member_id uuid not null, note text not null default '',
 foreign key(session_id,member_id) references public.pt_sessions(id,member_id)
);
create table public.pt_assessments (
 id uuid primary key default gen_random_uuid(), member_id uuid not null references public.pt_members(id),
 assessed_on date not null, metric text not null check(length(trim(metric))>0),
 side text not null default '해당 없음' check(side in ('해당 없음','좌','우')),
 value numeric not null check(value>=0), unit text not null check(length(trim(unit))>0), conditions text not null default '',
 created_at timestamptz not null default now()
);
create table public.pt_templates (
 id uuid primary key default gen_random_uuid(), title text not null check(length(trim(title))>0),
 workout jsonb not null check(jsonb_typeof(workout)='array'), created_at timestamptz not null default now()
);
create table public.pt_session_audit (
 id bigint generated always as identity primary key, session_id uuid not null references public.pt_sessions(id),
 actor_id uuid not null, old_status text, new_status text not null, changed_at timestamptz not null default now()
);
create index pt_packages_member_idx on public.pt_packages(member_id);
create index pt_sessions_member_date_idx on public.pt_sessions(member_id,session_date);
create index pt_sessions_package_status_idx on public.pt_sessions(package_id,status);
create index pt_private_member_idx on public.pt_session_private(member_id);
create index pt_assessments_member_date_idx on public.pt_assessments(member_id,assessed_on);
create index pt_audit_session_idx on public.pt_session_audit(session_id);
-- Only administrators may write PT records; members may read their own shared records.
DO $policies$
declare t text;
begin
 foreach t in array array['pt_members','pt_packages','pt_sessions','pt_session_private','pt_assessments','pt_templates','pt_session_audit'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from anon, authenticated',t);
  execute format('grant select, insert on public.%I to authenticated',t);
  execute format('create policy pt_admin_read on public.%I for select to authenticated using ((select public.is_ntac_admin()))',t);
  execute format('create policy pt_admin_insert on public.%I for insert to authenticated with check ((select public.is_ntac_admin()))',t);
 end loop;
 foreach t in array array['pt_members','pt_sessions','pt_session_private'] loop
  execute format('grant update on public.%I to authenticated',t);
  execute format('create policy pt_admin_update on public.%I for update to authenticated using ((select public.is_ntac_admin())) with check ((select public.is_ntac_admin()))',t);
 end loop;
 foreach t in array array['pt_packages','pt_sessions','pt_assessments'] loop
  execute format('create policy pt_member_read on public.%I for select to authenticated using (exists(select 1 from public.pt_members m where m.id=member_id and m.profile_id=(select auth.uid())))',t);
 end loop;
end $policies$;
create policy pt_member_read on public.pt_members for select to authenticated using(profile_id=(select auth.uid()));
grant usage on sequence public.pt_session_audit_id_seq to authenticated;
create function public.pt_validate_session() returns trigger language plpgsql security invoker set search_path='' as $$
declare p public.pt_packages; used_count integer;
begin
 if auth.uid() is null or not public.is_ntac_admin() then raise exception '관리자만 수업을 변경할 수 있습니다.'; end if;
 if TG_OP='UPDATE' and (new.member_id<>old.member_id or new.package_id<>old.package_id) then raise exception '저장된 수업의 회원과 이용권은 변경할 수 없습니다.'; end if;
 -- Serialize completion across all sessions of one package, including concurrent requests.
 select * into p from public.pt_packages where id=new.package_id for update;
 if not found then raise exception '이용권을 찾을 수 없습니다.'; end if;
 if new.status<>'cancelled' and (new.session_date<p.starts_on or (p.expires_on is not null and new.session_date>p.expires_on)) then raise exception '수업 날짜가 이용권 기간 밖입니다.'; end if;
 if new.status='completed' then
  if new.session_date > (now() at time zone 'Asia/Seoul')::date then raise exception '미래 수업은 완료할 수 없습니다.'; end if;
  select count(*) into used_count from public.pt_sessions where package_id=new.package_id and status='completed' and id<>new.id;
  if used_count>=p.total_sessions then raise exception '이용권의 남은 횟수가 없습니다.'; end if;
 end if;
 new.updated_at=now(); return new;
end $$;
-- FOR UPDATE requires UPDATE privilege, with an admin-only policy; immutable capacity below.
grant update on public.pt_packages to authenticated;
create policy pt_admin_update on public.pt_packages for update to authenticated using((select public.is_ntac_admin())) with check((select public.is_ntac_admin()));
create function public.pt_keep_package() returns trigger language plpgsql security invoker set search_path='' as $$
begin raise exception '이용권 수정 대신 새 이용권을 등록해 주세요.'; end $$;
create trigger pt_package_immutable before update on public.pt_packages for each row execute function public.pt_keep_package();
create trigger pt_validate_session before insert or update on public.pt_sessions for each row execute function public.pt_validate_session();
create function public.pt_audit_session() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if TG_OP='INSERT' then insert into public.pt_session_audit(session_id,actor_id,new_status) values(new.id,auth.uid(),new.status);
 elsif new.status<>old.status then insert into public.pt_session_audit(session_id,actor_id,old_status,new_status) values(new.id,auth.uid(),old.status,new.status); end if;
 return new;
end $$;
create trigger pt_audit_session after insert or update on public.pt_sessions for each row execute function public.pt_audit_session();
create function public.pt_save_session(payload jsonb) returns uuid language plpgsql security invoker set search_path='' as $$
declare sid uuid := (payload->>'id')::uuid; mid uuid := (payload->>'member_id')::uuid;
begin
 if auth.uid() is null or not public.is_ntac_admin() then raise exception '관리자 권한이 필요합니다.'; end if;
 insert into public.pt_sessions(id,member_id,package_id,session_date,start_time,title,status,workout,feedback,homework,session_rpe)
 values(sid,mid,(payload->>'package_id')::uuid,(payload->>'session_date')::date,(payload->>'start_time')::time,payload->>'title',payload->>'status',payload->'workout',coalesce(payload->>'feedback',''),coalesce(payload->>'homework',''),(payload->>'session_rpe')::numeric)
 on conflict(id) do update set session_date=excluded.session_date,start_time=excluded.start_time,title=excluded.title,status=excluded.status,workout=excluded.workout,feedback=excluded.feedback,homework=excluded.homework,session_rpe=excluded.session_rpe;
 insert into public.pt_session_private(session_id,member_id,note) values(sid,mid,coalesce(payload->>'private_note','')) on conflict(session_id) do update set note=excluded.note;
 return sid;
end $$;
revoke execute on function public.pt_save_session(jsonb) from public,anon;
grant execute on function public.pt_save_session(jsonb) to authenticated;
revoke execute on function public.pt_validate_session(),public.pt_audit_session(),public.pt_keep_package() from public,anon,authenticated;
-- Retain NTAC signup semantics; PT signup starts without an NTAC trial or PT entitlement.
create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path='public' as $$
declare is_pt boolean := coalesce(new.raw_user_meta_data->>'signup_source','')='pt';
begin
 if coalesce(new.raw_user_meta_data->>'signup_source','')='team_games' then return new; end if;
 insert into public.profiles(id,email,full_name,role,membership,membership_status,coach_care,coach_name,onboarding_completed,trial_started_at,trial_ends_at,signup_source,training_goal,phone,privacy_consent_at)
 values(new.id,new.email,coalesce(new.raw_user_meta_data->>'full_name',''),'member',case when is_pt then 'PT' else 'TRIAL' end,'active',false,'미배정',false,case when is_pt then null else now() end,case when is_pt then null else current_date+6 end,case when is_pt then 'pt' else null end,case when is_pt then new.raw_user_meta_data->>'training_goal' else null end,case when is_pt then new.raw_user_meta_data->>'phone' else null end,case when is_pt and new.raw_user_meta_data->>'privacy_consent'='true' then now() else null end)
 on conflict(id) do nothing; return new;
end $$;
