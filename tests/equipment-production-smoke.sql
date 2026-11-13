begin;
do $$
declare r jsonb; plate jsonb; total numeric; target numeric; bar numeric; i int; aid uuid; uid uuid; cid uuid:=gen_random_uuid(); nid uuid:=gen_random_uuid(); pid uuid; rev int; m jsonb;
begin
 foreach bar in array array[7.5,15,20]::numeric[] loop
  for i in 1..400 loop
   target:=i/2.0;r:=private.group_equipment_load(target,bar);
   if target<bar then
    if r->>'weight' is not null then raise exception 'Load below empty bar accepted';end if;
    continue;
   end if;
   total:=bar;
   for plate in select value from jsonb_array_elements(r->'plates_per_side') loop
    total:=total+2*(plate->>'kg')::numeric*(plate->>'count')::int;
    if (plate->>'kg')::numeric=1 and (plate->>'count')::int>2 or (plate->>'kg')::numeric in (1.5,2.5) and (plate->>'count')::int>3 then raise exception 'Microplate stock exceeded';end if;
   end loop;
   if total<>(r->>'weight')::numeric or total>target or total<bar then raise exception 'Infeasible/asymmetric/over-target load';end if;
  end loop;
 end loop;
 if private.group_equipment_load(null,20)->>'weight' is not null or private.group_equipment_load(100,10)->>'weight' is not null then raise exception 'Invalid equipment accepted';end if;
 if (private.group_equipment_load(61.54,20)->>'weight')::numeric<>61 or (private.group_equipment_load(63,20)->>'weight')::numeric<>63 or (private.group_equipment_load(58.54,7.5)->>'weight')::numeric<>58.5 then raise exception 'Detailed loading wrong';end if;
 if has_function_privilege('anon','private.group_equipment_load(numeric,numeric)','execute') or has_function_privilege('authenticated','private.group_recommend_before_equipment(uuid,uuid,text)','execute') then raise exception 'Private helper exposed';end if;
 select id into aid from public.profiles where role in ('owner','admin') order by id limit 1;
 select id into uid from public.profiles where role='member' order by id limit 1;
 if aid is null or uid is null then raise exception 'Need admin/member fixture';end if;
 m:='[{"id":"sq","exercise_id":"back_squat","label":"Squat","kind":"weight","training_type":"strength","record_use":"strength_estimate","unit":"kg","load_basis":"total","target_reps":8,"load_step":2.5,"min_load":0,"sets":[{"reps":8,"rir":2}]}]';
 insert into public.group_classes(id,title,starts_at,coach_id,created_by,status,movements) values
 (cid,'ROLLBACK EQUIPMENT SOURCE',now()+interval '2 hours',aid,aid,'published',m),
 (nid,'ROLLBACK EQUIPMENT NEXT',now()+interval '3 hours',aid,aid,'published',jsonb_set(m,'{0,sets}','[{"reps":6,"rir":2},{"reps":8,"rir":3},{"reps":8,"rir":2}]'));
 insert into public.group_members(user_id,active) values(uid,true) on conflict(user_id) do update set active=true;
 perform set_config('request.jwt.claim.sub',aid::text,true);perform set_config('role','authenticated',true);
 perform public.group_join(cid,array[uid]);
 select id,revision into pid,rev from public.group_participants where class_id=cid and user_id=uid;
 perform public.group_save_last_sets(pid,rev,'[{"movement_id":"sq","set_index":1,"weight":60,"reps":8,"rpe":8}]');
 perform public.group_join(nid,array[uid]);r:=public.group_detail(nid)->'participants'->0->'recommendations'->'sq';
 if (r->'sets'->0->>'weight')::numeric<>63 or (r->'sets'->1->>'weight')::numeric<>58 or (r->'sets'->2->>'weight')::numeric<>60 then raise exception 'RPE target / 5 percent ceiling / equipment integration wrong: %',r;end if;
 if (r->'sets'->0->>'bar_weight')::numeric<>20 or (r->'sets'->1->>'bar_weight')::numeric<>20 then raise exception 'Bar changes between sets';end if;
end $$;
rollback;
select 'PASS: feasible symmetric stock-bounded per-bar loads, 1200 targets, unchanged RPE estimation/growth ceiling, stable bar, private helpers; rollback only' as result;
