alter table public.profiles add column ntac_enabled boolean not null default false;
alter table public.profiles add column assigned_coach_id uuid references public.profiles(id);
alter table public.profiles drop constraint profiles_role_check;
alter table public.profiles add constraint profiles_role_check check(role in ('owner','admin','coach','member'));
update public.profiles set ntac_enabled=(membership<>'PT'),membership_status='active',paid_until=null,trial_started_at=null,trial_ends_at=null,access_override_until=null,coach_care=(membership<>'PT');
alter table public.pt_members add column active boolean not null default true;
alter table public.pt_members add column coach_id uuid references public.profiles(id);
create index pt_members_coach_idx on public.pt_members(coach_id);
create index profiles_coach_idx on public.profiles(assigned_coach_id);
create or replace function private.pt_is_coach() returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(select 1 from public.profiles where id=auth.uid() and role='coach');
$$;
revoke all on function private.pt_is_coach() from public,anon;
grant usage on schema private to authenticated;
grant execute on function private.pt_is_coach() to authenticated;
create or replace function private.pt_can_manage(mid uuid) returns boolean language sql stable security invoker set search_path='' as $$
 select auth.uid() is not null and (public.is_ntac_admin() or (private.pt_is_coach() and exists(select 1 from public.pt_members where id=mid and coach_id=auth.uid() and active)));
$$;
revoke all on function private.pt_can_manage(uuid) from public,anon;
grant execute on function private.pt_can_manage(uuid) to authenticated;
create policy pt_assigned_coach_read on public.pt_members for select to authenticated using(coach_id=(select auth.uid()) and active and (select private.pt_is_coach()));
create policy pt_assigned_profiles on public.profiles for select to authenticated using((select private.pt_is_coach()) and exists(select 1 from public.pt_members where profile_id=profiles.id and coach_id=(select auth.uid()) and active));
DO $$ declare t text; begin
 foreach t in array array['pt_sessions','pt_session_private','pt_assessments'] loop
  execute format('create policy pt_coach_read on public.%I for select to authenticated using(private.pt_can_manage(member_id))',t);
  execute format('create policy pt_coach_insert on public.%I for insert to authenticated with check(private.pt_can_manage(member_id))',t);
 end loop;
 foreach t in array array['pt_sessions','pt_session_private'] loop
  execute format('create policy pt_coach_update on public.%I for update to authenticated using(private.pt_can_manage(member_id)) with check(private.pt_can_manage(member_id))',t);
 end loop;
end $$;
create policy pt_coach_package_read on public.pt_packages for select to authenticated using(private.pt_can_manage(member_id));
-- UPDATE privilege is needed for the completion lock, but the guard below keeps coaches from editing packages.
create policy pt_coach_package_lock on public.pt_packages for update to authenticated using(private.pt_can_manage(member_id)) with check(private.pt_can_manage(member_id));
create policy pt_coach_audit_read on public.pt_session_audit for select to authenticated using(exists(select 1 from public.pt_sessions s where s.id=session_id and private.pt_can_manage(s.member_id)));
create policy pt_coach_audit_insert on public.pt_session_audit for insert to authenticated with check(actor_id=(select auth.uid()) and exists(select 1 from public.pt_sessions s where s.id=session_id and private.pt_can_manage(s.member_id)));
create policy pt_coach_template_read on public.pt_templates for select to authenticated using((select private.pt_is_coach()));
create policy pt_coach_template_insert on public.pt_templates for insert to authenticated with check((select private.pt_is_coach()));
drop trigger pt_package_immutable on public.pt_packages;
update public.pt_packages set expires_on=null;
create or replace function public.pt_keep_package() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if not public.is_ntac_admin() then raise exception '이용권은 관리자만 수정할 수 있습니다.'; end if;
 if new.member_id<>old.member_id then raise exception '이용권의 회원은 변경할 수 없습니다.'; end if;
 if new.total_sessions<(select count(*) from public.pt_sessions where package_id=old.id and status='completed') then raise exception '사용 횟수보다 적게 변경할 수 없습니다.'; end if;
 new.expires_on=null;return new;
end $$;
create trigger pt_package_immutable before update on public.pt_packages for each row execute function public.pt_keep_package();
-- Apply scoped coach authorization and remove package expiry checks from the existing atomic session pipeline.
DO $$ declare body text; begin
 select pg_get_functiondef('public.pt_validate_session()'::regprocedure) into body;
 body:=replace(body,'not public.is_ntac_admin()','not private.pt_can_manage(new.member_id)');
 body:=replace(body,'if new.status<>''cancelled'' and (new.session_date<p.starts_on or (p.expires_on is not null and new.session_date>p.expires_on))','if new.status<>''cancelled'' and new.session_date<p.starts_on');
 execute body;
 select pg_get_functiondef('public.pt_save_session(jsonb)'::regprocedure) into body;
 body:=replace(body,'not public.is_ntac_admin()','not private.pt_can_manage(mid)');execute body;
end $$;
create function public.set_member_services(target_id uuid, enable_ntac boolean, enable_pt boolean, coach_id uuid default null) returns void language plpgsql security invoker set search_path='' as $$
declare coach_label text;
begin
 if auth.uid() is null or not public.is_ntac_admin() then raise exception '관리자만 이용 구분과 담당 코치를 지정할 수 있습니다.'; end if;
 if coach_id is not null then
  select full_name into coach_label from public.profiles where id=coach_id and role in ('owner','admin','coach');
  if not found then raise exception '등록된 코치를 선택해 주세요.'; end if;
 end if;
 update public.profiles set ntac_enabled=enable_ntac,assigned_coach_id=coach_id,coach_name=coalesce(coach_label,'미배정'),coach_care=enable_ntac,membership=case when enable_ntac then 'NTAC ATHLETE' else 'PT' end,membership_status='active',paid_until=null,trial_ends_at=null,trial_started_at=null,access_override_until=null where id=target_id;
 if not found then raise exception '회원을 찾을 수 없습니다.'; end if;
 if enable_pt then
  insert into public.pt_members(profile_id,coach_id,active) values(target_id,coach_id,true)
  on conflict(profile_id) do update set active=true,coach_id=excluded.coach_id;
 else update public.pt_members set active=false,coach_id=set_member_services.coach_id where profile_id=target_id;
 end if;
end $$;
revoke all on function public.set_member_services(uuid,boolean,boolean,uuid) from public,anon;
grant execute on function public.set_member_services(uuid,boolean,boolean,uuid) to authenticated;
create function public.register_pt_coach(target_id uuid) returns void language plpgsql security invoker set search_path='' as $$
begin
 if auth.uid() is null or not public.is_ntac_admin() then raise exception '관리자 권한이 필요합니다.'; end if;
 update public.profiles set role='coach' where id=target_id and role='member';
 if not found then raise exception '일반 회원 계정을 선택해 주세요.'; end if;
end $$;
revoke all on function public.register_pt_coach(uuid) from public,anon;
grant execute on function public.register_pt_coach(uuid) to authenticated;
-- No trial or product signup. New accounts wait for an administrator to assign their programs.
create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if coalesce(new.raw_user_meta_data->>'signup_source','')='team_games' then return new; end if;
 insert into public.profiles(id,email,full_name,role,membership,membership_status,ntac_enabled,coach_care,coach_name,onboarding_completed,phone,training_goal,privacy_consent_at,signup_source)
 values(new.id,new.email,coalesce(new.raw_user_meta_data->>'full_name',''),'member','PT','active',false,false,'미배정',false,new.raw_user_meta_data->>'phone',new.raw_user_meta_data->>'training_goal',case when new.raw_user_meta_data->>'privacy_consent'='true' then now() else null end,'member') on conflict(id) do nothing;
 return new;
end $$;
-- Retired legacy signup trigger must not recreate trials for cached old clients.
drop trigger if exists zzz_ntac_self_trial_profile on auth.users;
revoke execute on function public.start_my_build_trial() from public,anon,authenticated;
revoke insert,update,delete on public.purchase_inquiries from anon,authenticated;
revoke insert,update,delete on public.coach_session_requests from anon,authenticated;
