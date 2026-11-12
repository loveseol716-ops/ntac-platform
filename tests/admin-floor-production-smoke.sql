begin;
do $$
declare aid uuid; uid uuid; future_id uuid:=gen_random_uuid(); past_id uuid:=gen_random_uuid(); draft_id uuid:=gen_random_uuid(); d jsonb; r jsonb;
begin
 select id into aid from public.profiles where role in ('owner','admin') order by id limit 1;
 select id into uid from public.profiles where role='member' order by id limit 1;
 if aid is null or uid is null then raise exception 'Need administrator/member';end if;
 insert into public.group_members(user_id,active) values(uid,true) on conflict(user_id) do update set active=true;
 insert into public.group_classes(id,title,starts_at,coach_id,created_by,status) values
 (future_id,'ROLLBACK EARLY ADMIN',now()+interval '2 hours',aid,aid,'published'),
 (past_id,'ROLLBACK LATE ADMIN',now()-interval '2 hours',aid,aid,'published'),
 (draft_id,'ROLLBACK DRAFT ADMIN',now()+interval '2 hours',aid,aid,'draft');
 perform set_config('request.jwt.claim.sub',uid::text,true);
 perform set_config('role','authenticated',true);
 begin
  perform public.group_join(future_id);raise exception 'EARLY MEMBER ACCEPTED';
 exception when raise_exception then if SQLERRM not like '수업 시작 30분%' then raise;end if;end;
 begin
  perform public.group_floor_directory(future_id);raise exception 'MEMBER DIRECTORY ACCEPTED';
 exception when raise_exception then if SQLERRM not like '관리자 또는 담당 코치%' then raise;end if;end;
 perform set_config('request.jwt.claim.sub',aid::text,true);
 r:=public.group_join(future_id,array[uid]);
 if (r->>'added')::integer<>1 then raise exception 'Early admin addition failed';end if;
 if (select status from public.group_participants where class_id=future_id and user_id=uid)<>'planned' then raise exception 'Future addition fabricated attendance';end if;
 r:=public.group_join(past_id,array[uid]);
 if (r->>'added')::integer<>1 then raise exception 'Late admin addition failed';end if;
 if (select status from public.group_participants where class_id=past_id and user_id=uid)<>'active' then raise exception 'Late addition unexpectedly completed workout';end if;
 r:=public.group_join(past_id,array[uid]);
 if (r->>'existing')::integer<>1 then raise exception 'Duplicate attendance inserted';end if;
 d:=public.group_floor_directory(future_id);
 select value into r from jsonb_array_elements(d) where value->>'id'=uid::text;
 if r is null or r ? 'phone' or r ? 'birth_date' or length(coalesce(r->>'phone_suffix',''))>4 then raise exception 'Directory identification privacy failure';end if;
 begin
  perform public.group_join(draft_id,array[uid]);raise exception 'DRAFT ACCEPTED';
 exception when raise_exception then if SQLERRM not like '수업 시작 30분%' then raise;end if;end;
 perform set_config('request.jwt.claim.sub',uid::text,true);
 begin
  perform public.group_join(past_id);raise exception 'LATE MEMBER ACCEPTED';
 exception when raise_exception then if SQLERRM not like '수업 시작 30분%' then raise;end if;end;
end $$;
rollback;
select 'PASS: early/late administrator entry, unchanged member window, future planned state, duplicates, draft guard and staff-only masked identifiers; rollback only' as result;
