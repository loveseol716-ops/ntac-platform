alter table public.profiles add column deleted_at timestamptz;
alter table public.profiles add column deleted_by uuid references public.profiles(id);

create function private.ntac_valid_member_name(value text) returns boolean
language sql immutable security invoker set search_path='' as $$
 select coalesce(length(trim(value)) between 2 and 80 and value ~ '[[:alpha:]]'
  and lower(regexp_replace(value,'[[:space:]]','','g')) not in ('이름없음','회원','unknown','undefined','null'),false);
$$;
revoke all on function private.ntac_valid_member_name(text) from public,anon;
grant execute on function private.ntac_valid_member_name(text) to authenticated;

-- Existing unnamed accounts can remain until their next visit, but names cannot
-- be changed back to a blank/placeholder. Only trusted functions can tombstone.
create function private.ntac_guard_member_identity() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
 if (new.deleted_at,new.deleted_by) is distinct from (old.deleted_at,old.deleted_by)
  and current_user not in ('postgres','supabase_admin','service_role') then
  raise exception '계정 삭제 상태는 직접 변경할 수 없어요.';
 end if;
 if old.deleted_at is not null and (new.deleted_at is null or new.role<>old.role or new.ntac_enabled or new.membership_status<>'expired') then
  raise exception '삭제된 계정은 다시 활성화할 수 없어요.';
 end if;
 if new.full_name is distinct from old.full_name and not private.ntac_valid_member_name(new.full_name) then
  raise exception '실제 이름을 2~80자로 입력해 주세요.';
 end if;
 return new;
end $$;
revoke all on function private.ntac_guard_member_identity() from public,anon,authenticated;
create trigger ntac_guard_member_identity before update on public.profiles
for each row execute function private.ntac_guard_member_identity();

create function private.ntac_set_my_name(full_name text) returns void
language plpgsql security definer set search_path='' as $$
declare n text:=trim(regexp_replace(full_name,'[[:space:]]+',' ','g'));
begin
 if auth.uid() is null then raise exception '로그인이 필요해요.'; end if;
 if not private.ntac_valid_member_name(n) then raise exception '실제 이름을 2~80자로 입력해 주세요.'; end if;
 update public.profiles p set full_name=n where p.id=auth.uid() and p.deleted_at is null;
 if not found then raise exception '이용 가능한 회원 계정이 없어요.'; end if;
end $$;
create function public.ntac_set_my_name(full_name text) returns void
language sql security invoker set search_path='' as $$ select private.ntac_set_my_name(full_name); $$;
revoke all on function private.ntac_set_my_name(text),public.ntac_set_my_name(text) from public,anon;
grant execute on function private.ntac_set_my_name(text),public.ntac_set_my_name(text) to authenticated;

-- Called through the verified administrator's JWT by the account deletion Edge
-- Function. Recheck role, target and confirmation under row locks; preserve FKs.
create function private.ntac_disable_member_account(target_id uuid,confirm_email text) returns void
language plpgsql security definer set search_path='' as $$
declare actor public.profiles; target public.profiles;
begin
 select * into actor from public.profiles where id=auth.uid() for update;
 if auth.uid() is null or actor.id is null or actor.deleted_at is not null or actor.role not in ('owner','admin') then raise exception '관리자 권한이 필요해요.'; end if;
 select * into target from public.profiles where id=target_id for update;
 if not found then raise exception '회원을 찾을 수 없어요.'; end if;
 if target.id=auth.uid() or target.role<>'member' then raise exception '일반 회원 계정만 삭제할 수 있어요.'; end if;
 if nullif(trim(confirm_email),'') is null or lower(trim(confirm_email)) is distinct from lower(trim(target.email)) then raise exception '회원 이메일을 정확히 입력해 주세요.'; end if;
 update public.profiles set deleted_at=coalesce(deleted_at,now()),deleted_by=coalesce(deleted_by,auth.uid()),ntac_enabled=false,coach_care=false,membership_status='expired' where id=target_id;
 update public.pt_members set active=false where profile_id=target_id;
 update public.group_members set active=false,updated_at=now() where user_id=target_id;
end $$;
create function public.ntac_disable_member_account(target_id uuid,confirm_email text) returns void
language sql security invoker set search_path='' as $$ select private.ntac_disable_member_account(target_id,confirm_email); $$;
revoke all on function private.ntac_disable_member_account(uuid,text),public.ntac_disable_member_account(uuid,text) from public,anon;
grant execute on function private.ntac_disable_member_account(uuid,text),public.ntac_disable_member_account(uuid,text) to authenticated;

-- Apply to every REST table/RPC request, including SECURITY DEFINER RPCs and
-- previously issued access tokens. Name repair and own-profile reads stay usable.
create function private.ntac_check_account_request() returns void
language plpgsql stable security definer set search_path='' as $$
declare p public.profiles; path text:=coalesce(current_setting('request.path',true),'');
begin
 if auth.uid() is null then return; end if;
 select * into p from public.profiles where id=auth.uid();
 if p.deleted_at is not null then raise sqlstate 'PT403' using message='삭제된 계정입니다. 이용 문의는 코치에게 해주세요.'; end if;
 if p.id is not null and not private.ntac_valid_member_name(p.full_name)
  and path !~ '(^|/)profiles$|(^|/)rpc/(ntac_set_my_name|ntac_save_profile)$' then
  raise sqlstate 'PT428' using message='이름을 먼저 입력해 주세요.';
 end if;
end $$;
revoke all on function private.ntac_check_account_request() from public;
grant usage on schema private to anon,authenticated,service_role;
grant execute on function private.ntac_check_account_request() to anon,authenticated,service_role;
do $$ begin
 if exists(select 1 from pg_db_role_setting s join pg_roles r on r.oid=s.setrole,
  unnest(s.setconfig) config where r.rolname='authenticator' and config like 'pgrst.db_pre_request=%'
  and config not in ('pgrst.db_pre_request=','pgrst.db_pre_request=private.ntac_check_account_request')) then
  raise exception 'An existing API request hook must be composed, not replaced';
 end if;
end $$;
alter role authenticator set pgrst.db_pre_request='private.ntac_check_account_request';
notify pgrst,'reload config';
notify pgrst,'reload schema';
