begin;
do $$
declare aid uuid; uid uuid; other_uid uuid; source uuid:=gen_random_uuid(); target uuid:=gen_random_uuid(); pid uuid; revision integer; r jsonb; d jsonb; m jsonb;
begin
 select id into aid from public.profiles where role in ('owner','admin') order by id limit 1;
 select id into uid from public.profiles where role='member' order by id limit 1;
 select id into other_uid from public.profiles where role='member' and id<>uid order by id limit 1;
 if aid is null or uid is null or other_uid is null then raise exception 'Need admin and two members';end if;
 m:='{"id":"sq","exercise_id":"back_squat","label":"Squat","kind":"weight","training_type":"strength","record_use":"strength_estimate","unit":"kg","load_basis":"total","target_reps":8,"load_step":2.5,"min_load":0,"sets":[{"reps":8,"rir":3},{"reps":8,"rir":3},{"reps":8,"rir":3},{"reps":8,"rir":3}]}'::jsonb;
 insert into public.group_classes(id,title,starts_at,duration_minutes,coach_id,created_by,status,movements,recording_version) values
 (source,'ROLLBACK LAST SET',now()-interval '10 minutes',50,aid,aid,'published',jsonb_build_array(m),2),
 (target,'ROLLBACK NEXT CLASS',now()+interval '10 minutes',50,aid,aid,'published',jsonb_build_array(m),2);
 insert into public.group_members(user_id,active) values(uid,true),(other_uid,true) on conflict(user_id) do update set active=true;
 insert into public.group_participants(class_id,user_id,status) values(source,uid,'active') returning id,group_participants.revision into pid,revision;
 if private.group_recommend(target,gen_random_uuid(),'standard')->'sq'->'weight'<>'null'::jsonb then raise exception 'No-data user must have null recommendation';end if;
 perform set_config('request.jwt.claim.sub',other_uid::text,true);
 perform set_config('role','authenticated',true);
 begin
  perform public.group_save_last_sets(pid,revision,'[{"movement_id":"sq","set_index":4,"weight":40,"reps":8,"rpe":8}]');raise exception 'OTHER USER ACCEPTED';
 exception when raise_exception then if SQLERRM not like '본인%' then raise;end if;end;
 perform set_config('request.jwt.claim.sub',uid::text,true);
 begin
  perform public.group_save_last_sets(pid,revision,'[{"movement_id":"sq","set_index":4,"weight":40,"reps":8,"rpe":11}]');raise exception 'INVALID RPE ACCEPTED';
 exception when raise_exception then if SQLERRM not like '중량·반복%' then raise;end if;end;
 perform public.group_save_last_sets(pid,revision,'[{"movement_id":"sq","set_index":4,"weight":40,"reps":8,"rpe":8}]');
 select public.group_detail(source) into d;
 if (d->'participants'->0->'results'->'sq'->'sets'->0)<>'{}'::jsonb or (d->'participants'->0->'results'->'sq'->'sets'->3->>'weight')::numeric<>40 then raise exception 'Summary fabricated other sets';end if;
 if (d->'participants'->0->'last_sets'->'sq'->>'rpe')::numeric<>8 then raise exception 'Summary detail missing';end if;
 begin
  perform public.group_save_last_sets(pid,revision,'[{"movement_id":"sq","set_index":4,"weight":45,"reps":8,"rpe":7}]');raise exception 'STALE REVISION ACCEPTED';
 exception when raise_exception then if SQLERRM not like '다른 기기%' then raise;end if;end;
 perform set_config('role','postgres',true);
 r:=private.group_recommend(target,uid,'standard')->'sq';
 if r->>'source'<>'recent_last_set' or (r->>'weight')::numeric<>37.5 then raise exception 'Latest actual RPE did not affect next recommendation: %',r;end if;
 -- A corrected lower-effort performance raises the next recommendation without coach finalization.
 select p.revision into revision from public.group_participants p where p.id=pid;
 perform set_config('role','authenticated',true);
 perform public.group_save_last_sets(pid,revision,'[{"movement_id":"sq","set_index":3,"weight":50,"reps":8,"rpe":7}]');
 perform set_config('role','postgres',true);
 r:=private.group_recommend(target,uid,'standard')->'sq';
 if (r->>'weight')::numeric<>50 then raise exception 'Updated actual performance not used';end if;
 perform set_config('request.jwt.claim.sub',other_uid::text,true);
 perform set_config('role','authenticated',true);
 if exists(select 1 from public.group_last_sets where user_id=uid) then raise exception 'Other member summary exposed by RLS';end if;
 perform set_config('request.jwt.claim.sub',aid::text,true);
 select p.revision into revision from public.group_participants p where p.id=pid;
 perform public.group_save_last_sets(pid,revision,'[{"movement_id":"sq","set_index":3,"weight":45,"reps":8,"rpe":7}]');
 perform set_config('role','postgres',true);
 update public.group_members set active=false where user_id=uid;
 select p.revision into revision from public.group_participants p where p.id=pid;
 perform set_config('request.jwt.claim.sub',uid::text,true);
 perform set_config('role','authenticated',true);
 begin
  perform public.group_save_last_sets(pid,revision,'[{"movement_id":"sq","set_index":4,"weight":40,"reps":8,"rpe":8}]');raise exception 'EXPIRED MEMBER ACCEPTED';
 exception when raise_exception then if SQLERRM not like '본인%' then raise;end if;end;
end $$;
rollback;
select 'PASS: own/coach records, null recommendation, RPE validation, sparse true results, latest-data update, revision lock, expired access and RLS; rollback only' as result;
