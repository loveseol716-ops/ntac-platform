begin;
do $$
declare aid uuid; uid uuid; cid uuid:=gen_random_uuid(); next_id uuid:=gen_random_uuid(); pid uuid; rev integer; r jsonb; m jsonb;
begin
 select id into aid from public.profiles where role in ('owner','admin') order by id limit 1;
 select id into uid from public.profiles where role='member' order by id limit 1;
 if aid is null or uid is null then raise exception 'Need administrator/member';end if;
 m:='[{"id":"sq","exercise_id":"back_squat","label":"Squat","kind":"weight","training_type":"strength","record_use":"strength_estimate","unit":"kg","load_basis":"total","target_reps":8,"load_step":2.5,"min_load":0,"sets":[{"reps":8,"rir":3},{"reps":8,"rir":3}]}]';
 insert into public.group_classes(id,title,starts_at,coach_id,created_by,status,movements) values
 (cid,'ROLLBACK PRECLASS RECORD',now()+interval '2 hours',aid,aid,'published',m),
 (next_id,'ROLLBACK PRECLASS NEXT',now()+interval '3 hours',aid,aid,'published',m);
 insert into public.group_members(user_id,active) values(uid,true) on conflict(user_id) do update set active=true;
 perform set_config('request.jwt.claim.sub',aid::text,true);
 perform set_config('role','authenticated',true);
 perform public.group_join(cid,array[uid]);
 select id,revision into pid,rev from public.group_participants where class_id=cid and user_id=uid;
 perform set_config('request.jwt.claim.sub',uid::text,true);
 begin
  perform public.group_save_last_sets(pid,rev,'[{"movement_id":"sq","set_index":2,"weight":40,"reps":8,"rpe":7}]');raise exception 'EARLY MEMBER RECORD ACCEPTED';
 exception when raise_exception then if SQLERRM not like '참여한 수업%' then raise;end if;end;
 perform set_config('request.jwt.claim.sub',aid::text,true);
 perform public.group_save_last_sets(pid,rev,'[{"movement_id":"sq","set_index":2,"weight":40,"reps":8,"rpe":7}]');
 r:=public.group_detail(cid);
 if (r->'participants'->0->'last_sets'->'sq'->>'weight')::numeric<>40 then raise exception 'Admin preclass record missing';end if;
 perform public.group_join(next_id,array[uid]);
 r:=public.group_detail(next_id);
 if (r->'participants'->0->'recommendations'->'sq'->>'weight')::numeric<>40 then raise exception 'Explicit preclass record not used by later class';end if;
end $$;
rollback;
select 'PASS: administrator future planned record, unchanged member restriction and immediate later-class recommendation; rollback only' as result;
