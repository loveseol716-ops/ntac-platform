begin;
do $$
declare ws date; legacyid uuid:=gen_random_uuid(); nextcid uuid; pid uuid; rev int; aid uuid; uid uuid; cid uuid; n int; r jsonb; m jsonb; good jsonb; bad jsonb; rowid uuid; wid uuid; payload jsonb; programs jsonb; reason text:='ROLLBACK_SECRET_EXCEPTION: 코치 협의에 따라 운동을 변경하고 다음 수업에서 빠진 패턴을 보완합니다.';
begin
 select id into aid from public.profiles where role in ('owner','admin') order by id limit 1;
 select id into uid from public.profiles where role='member' order by id limit 1;
 m:='[{"id":"sq","exercise_id":"back_squat","label":"Squat","kind":"weight","training_type":"strength","record_use":"strength_estimate","unit":"kg","load_basis":"total","target_reps":8,"load_step":2.5,"min_load":0,"sets":[{"reps":8,"rir":4},{"reps":8,"rir":4},{"reps":8,"rir":4}]},{"id":"hpc","exercise_id":"hang_power_clean","label":"Hang","kind":"weight","training_type":"strength","record_use":"strength_estimate","unit":"kg","load_basis":"total","target_reps":2,"load_step":2.5,"min_load":0,"sets":[{"reps":2,"rir":4},{"reps":2,"rir":4},{"reps":2,"rir":4}]}]';
 if private.group_design_rule('2026-11-22','gentle_strength') is not null or private.group_design_rule('2027-01-04','gentle_strength') is not null or private.group_design_rule('2026-11-23','gentle_sweat') is not null then raise exception 'Rule leaks outside season/types';end if;
 if jsonb_array_length(private.group_design_issues('2026-11-23','gentle_strength',m))<>0 then raise exception 'Valid W1 rejected';end if;
 bad:=m-1;
 if jsonb_array_length(private.group_design_issues('2026-11-23','gentle_strength',bad))=0 then raise exception 'Missing exact hang identity accepted';end if;
 if jsonb_array_length(private.group_design_issues('2026-11-30','gentle_strength',m))=0 then raise exception 'W2 RPE7 not checked';end if;
 good:=jsonb_set(m,'{0,sets}','[{"reps":6,"rir":3}]');
 if jsonb_array_length(private.group_design_issues('2026-11-30','gentle_strength',good))<>0 then raise exception 'Valid W2 rejected';end if;
 good:=jsonb_set(jsonb_set(m,'{0,prescription_mode}','"percent_1rm"'),'{0,sets}','[{"reps":8,"percent_1rm":72}]');
 if jsonb_array_length(private.group_design_issues('2026-11-23','gentle_strength',good))<>0 then raise exception 'Equivalent percent band rejected';end if;
 bad:=jsonb_set(good,'{0,sets,0,percent_1rm}','95');
 if jsonb_array_length(private.group_design_issues('2026-11-23','gentle_strength',bad))=0 then raise exception 'Percent intensity bypass';end if;
 if jsonb_array_length(private.group_design_issues('2026-12-28','bomb_strength','[]'))<>0 then raise exception 'Metcon test forced into lifts';end if;
 good:=jsonb_set(jsonb_set(m,'{0,sets}','[{"reps":5,"rir":0}]'),'{1,sets}','[{"reps":1,"rir":0}]');
 if jsonb_array_length(private.group_design_issues('2026-12-28','gentle_strength',good))<>0 then raise exception '5RM/1RM test rejected';end if;
 insert into public.group_members(user_id,active) values(uid,true) on conflict(user_id) do update set active=true;
 -- Authoritative server guard: a direct RPC cannot bypass the form.
 perform set_config('request.jwt.claim.sub',aid::text,true);perform set_config('role','authenticated',true);
 payload:=jsonb_build_object('title','GENTLE STRENGTH','class_type_id','gentle_strength','starts_at','2026-11-23T09:00:00+09:00','duration_minutes',50,'coach_id',aid,'description','ROLLBACK BODY','movements',m);
 select count(*) into n from public.group_classes;
 begin perform public.group_save_class(payload||jsonb_build_object('movements',bad));raise exception 'GUARD BYPASSED';exception when raise_exception then if SQLERRM='GUARD BYPASSED' or SQLERRM not like '%20자%' then raise;end if;end;
 if (select count(*) from public.group_classes)<>n then raise exception 'Rejected save left a class';end if;
 cid:=public.group_save_class(payload||jsonb_build_object('movements',bad,'design_exception_reason',reason));
 r:=public.group_detail(cid);
 if r#>>'{class,design_exception_reason}'<>reason then raise exception 'Admin reason missing';end if;
 perform public.group_set_class_status(cid,'published',1);
 if (select movements::text from public.group_classes where id=cid) like '%ROLLBACK_SECRET%' then raise exception 'Reason leaked into public JSON';end if;
 perform public.group_join(cid,array[uid]);select id,revision into pid,rev from public.group_participants where class_id=cid and user_id=uid;
 perform public.group_save_last_sets(pid,rev,'[{"movement_id":"hpc","set_index":3,"weight":30,"reps":2,"rpe":6}]');
 nextcid:=public.group_save_class(payload||jsonb_build_object('starts_at','2026-11-24T09:00:00+09:00'));
 perform public.group_set_class_status(nextcid,'published',1);perform public.group_join(nextcid,array[uid]);
 r:=public.group_detail(nextcid);
 if (r#>>'{participants,0,recommendations,hpc,weight}')::numeric<>30 then raise exception 'Hang power-clean record not used independently: %',r;end if;


 -- Direct publication of an old draft also cannot bypass the guard.
 perform set_config('role','none',true);
 insert into public.group_classes(id,title,class_type_id,starts_at,coach_id,created_by,movements,description)
 values(legacyid,'GENTLE STRENGTH','gentle_strength','2026-11-23T08:00:00+09:00',aid,aid,bad,'legacy draft');
 perform set_config('role','authenticated',true);
 begin perform public.group_set_class_status(legacyid,'published',1);raise exception 'PUBLISH BYPASSED';exception when raise_exception then if SQLERRM='PUBLISH BYPASSED' or SQLERRM not like '%20자%' then raise;end if;end;
 if (select status from public.group_classes where id=legacyid)<>'draft' then raise exception 'Rejected publication changed draft';end if;
 -- Every written class in a weekly bundle is checked; untouched classes stay empty.
 select ('2026-11-23'::date+offs.k*7) into ws from generate_series(0,4) offs(k) where offs.k<>2 and not exists(select 1 from public.group_weeks where week_start='2026-11-23'::date+offs.k*7 and status<>'archived') order by offs.k limit 1;
 if ws is not null then
  select jsonb_agg(jsonb_build_object('class_type_id',t.id,'title',t.name,'description',case when t.id='gentle_strength' then 'ROLLBACK WEEK GUARD' else '' end,'movements',case when t.id='gentle_strength' then m-1 else '[]'::jsonb end)) into programs from public.group_class_types t;
  payload:=jsonb_build_object('title','ROLLBACK GUARD WEEK','week_start',ws,'program_mode','class_type','status','draft','programs',programs);
  begin perform public.group_save_week(payload);raise exception 'WEEK GUARD BYPASSED';exception when raise_exception then if SQLERRM='WEEK GUARD BYPASSED' or SQLERRM not like '%20자%' then raise;end if;end;
  select jsonb_agg(p||case when p->>'class_type_id'='gentle_strength' then jsonb_build_object('design_exception_reason',reason) else '{}'::jsonb end) into programs from jsonb_array_elements(programs) p;
  r:=public.group_save_week(payload||jsonb_build_object('programs',programs));
  if exists(select 1 from public.group_weeks w where w.id=(r->>'id')::uuid and w.programs::text like '%ROLLBACK_SECRET%') then raise exception 'Weekly reason leaked';end if;
 end if;
 -- Week 3 reference; week 4 keeps both set count and reps.
 select jsonb_agg(jsonb_build_object('class_type_id',t.id,'title',t.name,'description',case when t.id='gentle_strength' then 'ROLLBACK REFERENCE' else '' end,'movements',case when t.id='gentle_strength' then jsonb_set(m,'{0,sets}','[{"reps":4,"rir":3},{"reps":4,"rir":3}]') else '[]'::jsonb end)) into programs from public.group_class_types t;
 r:=public.group_save_week(jsonb_build_object('title','ROLLBACK W3','week_start','2026-12-07','program_mode','class_type','status','draft','programs',programs));
 wid:=(r->>'id')::uuid;
 good:=jsonb_set(jsonb_set(m,'{0,sets}','[{"reps":4,"rir":4},{"reps":4,"rir":4}]'),'{1,sets}','[{"reps":2,"rir":5},{"reps":2,"rir":5},{"reps":2,"rir":5}]');
 perform set_config('role','none',true);
 if jsonb_array_length(private.group_design_issues('2026-12-14','gentle_strength',good))<>0 then raise exception 'W4 same volume lower RPE rejected';end if;
 if private.group_design_issues('2026-12-14','gentle_strength',jsonb_set(good,'{0,sets}','[{"reps":4,"rir":3},{"reps":4,"rir":3}]'))::text not like '%강도를 낮춰%' then raise exception 'Unchanged W3 effort accepted';end if;
 if jsonb_array_length(private.group_design_issues('2026-12-14','gentle_strength',jsonb_set(good,'{0,sets}','[{"reps":4,"rir":4}]')))=0 then raise exception 'W4 reduced sets accepted';end if;
 -- Low-level helpers cannot be called directly by logged-in users.
 if has_function_privilege('authenticated','private.group_save_class_before_design(jsonb)','execute') or has_function_privilege('anon','public.group_design_reference(date,text)','execute') then raise exception 'Guard bypass helper exposed';end if;
 perform set_config('request.jwt.claim.sub',uid::text,true);perform set_config('role','authenticated',true);
 if exists(select 1 from public.group_key_descriptions where class_id=cid) then raise exception 'Member reads exception table';end if;
 r:=public.group_detail(cid);
 if r::text like '%ROLLBACK_SECRET_EXCEPTION%' or r->'class' ? 'design_exception_reason' then raise exception 'Member detail leaked exception';end if;
 begin perform public.group_design_reference('2026-12-14','gentle_strength');raise exception 'MEMBER REFERENCE ACCEPTED';exception when raise_exception then if SQLERRM='MEMBER REFERENCE ACCEPTED' or SQLERRM not like '%코치%' then raise;end if;end;
end $$;
rollback;
select 'PASS: week/type boundaries, exact hang identity, reps/RPE/percent exceptions, atomic save, private reasons, W4 matching volume, assessment exceptions and member denial; rollback only' as result;
