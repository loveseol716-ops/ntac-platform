begin;
do $$
declare aid uuid; uid uuid; sourceid uuid:=gen_random_uuid(); cid uuid:=gen_random_uuid(); nid uuid:=gen_random_uuid(); pid uuid; rev int; r jsonb; m jsonb; bad jsonb;
begin
 select id into aid from public.profiles where role in ('owner','admin') order by id limit 1;
 select id into uid from public.profiles where role='member' order by id limit 1;
 if aid is null or uid is null then raise exception 'Need admin/member fixture';end if;
 m:='[{"id":"sq","exercise_id":"back_squat","label":"Squat","kind":"weight","training_type":"strength","record_use":"strength_estimate","unit":"kg","load_basis":"total","target_reps":3,"load_step":2.5,"min_load":0,"prescription_mode":"percent_1rm","sets":[{"reps":3,"percent_1rm":78},{"reps":3,"percent_1rm":82}]}]';
 perform private.group_validate_movements(m);
 foreach bad in array array[jsonb_set(m,'{0,sets,0,percent_1rm}','0'),jsonb_set(m,'{0,sets,0,percent_1rm}','101'),jsonb_set(m,'{0,sets,0,percent_1rm}','"78"'),m#-'{0,sets,0,percent_1rm}',jsonb_set(m,'{0,prescription_mode}','"unknown"')] loop
  begin perform private.group_validate_movements(bad);raise exception 'INVALID PERCENT ACCEPTED';
  exception when raise_exception then if SQLERRM='INVALID PERCENT ACCEPTED' then raise;end if;end;
 end loop;
 insert into public.group_classes(id,title,starts_at,coach_id,created_by,status,movements) values
 (sourceid,'ROLLBACK PERCENT SOURCE',now()+interval '364 days',aid,aid,'published',jsonb_set(m,'{0,sets}','[{"reps":8,"percent_1rm":60}]')),
 (nid,'ROLLBACK PERCENT HISTORY',now()+interval '366 days',aid,aid,'published',m);
 -- No personal evidence means no fabricated recommendation.
 r:=private.group_recommend(nid,gen_random_uuid(),'standard');
 if r->'sq'->'sets'->0->>'weight' is not null then raise exception 'Missing evidence not blank';end if;
 insert into public.group_strength_maxes(user_id,exercise_id,unit,load_basis,weight,measured_on,basis,reason,updated_by)
 values(uid,'back_squat','kg','total',100,(now() at time zone 'Asia/Seoul')::date,'measured','ROLLBACK PERCENT',aid)
 on conflict(user_id,exercise_id,unit,load_basis) do update set weight=100,measured_on=excluded.measured_on,basis='measured';
 insert into public.group_members(user_id,active) values(uid,true) on conflict(user_id) do update set active=true;
 perform set_config('request.jwt.claim.sub',aid::text,true);perform set_config('role','authenticated',true);
 cid:=public.group_save_class(jsonb_build_object('title','GENTLE STRENGTH','class_type_id','gentle_strength','starts_at',now()+interval '365 days','duration_minutes',50,'coach_id',aid,'movements',m));
 perform public.group_set_class_status(cid,'published',1);
 perform public.group_join(cid,array[uid]);r:=public.group_detail(cid);
 perform public.group_save_template(r->'class');
 if (r->'participants'->0->'recommendations'->'sq'->'sets'->0->>'weight')::numeric<>78 or (r->'participants'->0->'recommendations'->'sq'->'sets'->1->>'weight')::numeric<>82 then raise exception '78/82 percent baseline recommendation wrong: %',r;end if;
 if r->'class'->'movements'->0->'sets'->0 ? 'rir' then raise exception 'Fabricated target RPE persisted';end if;
 perform public.group_join(sourceid,array[uid]);select id,revision into pid,rev from public.group_participants where class_id=sourceid and user_id=uid;
 perform public.group_save_last_sets(pid,rev,'[{"movement_id":"sq","set_index":1,"weight":60,"reps":8,"rpe":8}]');
 perform public.group_join(nid,array[uid]);r:=public.group_detail(nid)->'participants'->0->'recommendations'->'sq';
 -- Estimated 1RM 80: 78%=62.4 ->62; 82%=65.6, capped at 60*1.05 ->63.
 if (r->'sets'->0->>'weight')::numeric<>62 or (r->'sets'->1->>'weight')::numeric<>63 then raise exception 'Percentage from latest actual RPE/ceiling wrong: %',r;end if;
 if (r->'sets'->1->>'percent_1rm')::numeric<>82 then raise exception 'Percent projection missing';end if;
end $$;
rollback;
select 'PASS: percentage validation, 78/82 percent baseline, blank without evidence, latest actual RPE estimate and retained growth ceiling; rollback only' as result;
