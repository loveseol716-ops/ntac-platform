-- Transactional checks only; no real account or credential is deleted.
begin;
create temporary table identity_fixture as
select (select id from public.profiles where role='owner' and deleted_at is null order by id limit 1) admin_id,
       (select id from public.profiles where role='member' and deleted_at is null order by id limit 1) member_id;
grant select on identity_fixture to authenticated;
do $$ begin if exists(select 1 from identity_fixture where admin_id is null or member_id is null) then raise exception 'Test accounts unavailable'; end if; end $$;
create temporary table identity_before as select p.* from public.profiles p where id=(select member_id from identity_fixture);
grant select on identity_before to authenticated;
create temporary table identity_records as select
 (select count(*) from public.group_participants where user_id=(select member_id from identity_fixture)) group_count,
 (select count(*) from public.pt_members where profile_id=(select member_id from identity_fixture)) pt_count;
grant select on identity_records to authenticated;
select set_config('request.jwt.claim.sub',(select member_id::text from identity_fixture),true);
set local role authenticated;
do $$ declare n text; begin
 foreach n in array array['','  ','이름 없음','회원','unknown','123','A'] loop
  if private.ntac_valid_member_name(n) then raise exception 'Placeholder accepted'; end if;
  begin perform public.ntac_set_my_name(n); raise exception 'Invalid name saved'; exception when others then if sqlerrm not like '%이름%' then raise; end if; end;
 end loop;
 perform public.ntac_set_my_name('  테스트    회원  ');
 if not exists(select 1 from public.profiles where id=(select member_id from identity_fixture) and full_name='테스트 회원' and phone is not distinct from (select phone from identity_before)) then raise exception 'Name-only save changed other profile fields'; end if;
 begin perform public.ntac_disable_member_account((select member_id from identity_fixture),(select email from identity_before)); raise exception 'Member deleted account'; exception when others then if sqlerrm not like '%관리자%' then raise; end if; end;
 perform set_config('request.path','/rpc/group_bootstrap',true);
 perform private.ntac_check_account_request();
end $$;
reset role;
select set_config('request.jwt.claim.sub',(select admin_id::text from identity_fixture),true);
set local role authenticated;
do $$ begin
 begin update public.profiles set deleted_at=now() where id=(select member_id from identity_fixture); raise exception 'Direct tombstone write allowed'; exception when others then if sqlerrm not like '%직접 변경%' and sqlstate<>'42501' then raise; end if; end;
 begin perform public.ntac_disable_member_account((select member_id from identity_fixture),'wrong@example.invalid'); raise exception 'Wrong email accepted'; exception when others then if sqlerrm not like '%이메일%' then raise; end if; end;
 begin perform public.ntac_disable_member_account((select admin_id from identity_fixture),'wrong@example.invalid'); raise exception 'Admin deletion accepted'; exception when others then if sqlerrm not like '%일반 회원%' then raise; end if; end;
 perform public.ntac_disable_member_account((select member_id from identity_fixture),(select email from identity_before));
 perform public.ntac_disable_member_account((select member_id from identity_fixture),(select email from identity_before));
 if not exists(select 1 from public.profiles where id=(select member_id from identity_fixture) and deleted_at is not null and not ntac_enabled and membership_status='expired') then raise exception 'Account not tombstoned'; end if;
 if exists(select 1 from public.group_members where user_id=(select member_id from identity_fixture) and active) or exists(select 1 from public.pt_members where profile_id=(select member_id from identity_fixture) and active) then raise exception 'Service still active'; end if;
 if (select count(*) from public.group_participants where user_id=(select member_id from identity_fixture))<>(select group_count from identity_records) or (select count(*) from public.pt_members where profile_id=(select member_id from identity_fixture))<>(select pt_count from identity_records) then raise exception 'Historical record removed'; end if;
end $$;
reset role;
select set_config('request.jwt.claim.sub',(select member_id::text from identity_fixture),true);
set local role authenticated;
do $$ declare path text; begin
 foreach path in array array['/profiles','/rpc/group_bootstrap','/rpc/ntac_set_my_name','/weekly_programs'] loop
  perform set_config('request.path',path,true);
  begin perform private.ntac_check_account_request(); raise exception 'Old JWT request accepted'; exception when sqlstate 'PT403' then null; end;
 end loop;
 begin perform public.ntac_set_my_name('새 이름'); raise exception 'Deleted member renamed'; exception when others then if sqlerrm not like '%계정%' then raise; end if; end;
end $$;
reset role;
do $$ begin
 if has_function_privilege('anon','public.ntac_disable_member_account(uuid,text)','EXECUTE') or has_function_privilege('anon','public.ntac_set_my_name(text)','EXECUTE') then raise exception 'Anonymous mutation exposed'; end if;
 if not exists(select 1 from pg_db_role_setting s join pg_roles r on r.oid=s.setrole where r.rolname='authenticator' and 'pgrst.db_pre_request=private.ntac_check_account_request'=any(s.setconfig)) then raise exception 'Request hook not registered'; end if;
end $$;
rollback;
