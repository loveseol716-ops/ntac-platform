-- Hosted rollback-only verification. No fixture or member changes persist.
begin;
do $$
declare aid uuid; uid uuid; eid text; movement jsonb; target uuid; source uuid;
 logged uuid; qualified uuid; r jsonb; h jsonb; template_id uuid; before_max numeric;
begin
 select id into aid from public.profiles where role in ('owner','admin') order by id limit 1;
 select id into uid from public.profiles where role='member' order by id limit 1;
 if aid is null or uid is null then raise exception 'Smoke test requires existing admin/member';end if;
 perform set_config('request.jwt.claim.sub',aid::text,true);
 perform set_config('role','authenticated',true);
 eid:=public.group_add_exercise('ROLLBACK RECORD USE '||left(gen_random_uuid()::text,8));
 movement:=jsonb_build_object('id','ohp','exercise_id',eid,'label','OHP smoke','kind','weight','training_type','strength','record_use','strength_estimate','target_reps',8,'unit','kg','load_basis','total','load_step',2.5,'min_load',20,'sets','[{"reps":8,"rir":2}]'::jsonb);
 template_id:=public.group_save_template(jsonb_build_object('title','ROLLBACK MIXED USE','movements',jsonb_build_array(movement,movement||'{"id":"complex","record_use":"log_only"}'::jsonb)));
 if (select movements->1->>'record_use' from public.group_templates where id=template_id)<>'log_only' then raise exception 'Classification not saved';end if;
 begin
  perform public.group_save_template(jsonb_build_object('title','ROLLBACK INVALID','movements',jsonb_build_array(movement||'{"record_use":null}'::jsonb)));
  raise exception 'Invalid record use accepted';
 exception when raise_exception then if SQLERRM not like '기록 활용%' then raise;end if;end;
 perform public.group_set_strength_max(jsonb_build_object('user_id',uid,'exercise_id',eid,'weight',100,'unit','kg','load_basis','total','measured_on',(now() at time zone 'Asia/Seoul')::date,'basis','measured','reason','rollback test'));
 target:=public.group_save_class(jsonb_build_object('title','ROLLBACK TARGET','starts_at',now()+interval '1 hour','duration_minutes',50,'coach_id',aid,'movements',jsonb_build_array(movement)));
 perform set_config('role','postgres',true);
 insert into public.group_classes(title,starts_at,coach_id,created_by,status,movements)
 values('ROLLBACK LOG ONLY',now()-interval '1 hour',aid,aid,'ended',jsonb_build_array(movement||'{"record_use":"log_only"}'::jsonb)) returning id into source;
 insert into public.group_participants(class_id,user_id,status,finalized,session_rpe,results)
 values(source,uid,'completed',true,9,'{"ohp":{"sets":[{"weight":90,"reps":8,"rir":2}]}}') returning id into logged;
 r:=private.group_recommend(target,uid,'standard')->'ohp'->'sets'->0;
 if r->>'source'<>'one_rm' or (r->>'weight')::numeric<>75 then raise exception 'Log-only record contaminated recommendation';end if;
 update public.group_classes set movements=jsonb_build_array(movement-'record_use') where id=source;
 if private.group_recommend(target,uid,'standard')->'ohp'->'sets'->0->>'source'<>'one_rm' then raise exception 'Unclassified history contaminated recommendation';end if;
 update public.group_classes set movements=jsonb_build_array(movement||'{"record_use":"log_only"}'::jsonb) where id=source;
 insert into public.group_classes(title,starts_at,coach_id,created_by,status,movements)
 values('ROLLBACK ESTIMATE',now()-interval '2 hours',aid,aid,'ended',jsonb_build_array(movement)) returning id into source;
 insert into public.group_participants(class_id,user_id,status,finalized,session_rpe,results)
 values(source,uid,'completed',true,9,'{"ohp":{"sets":[{"weight":40,"reps":8,"rir":2}]}}') returning id into qualified;
 r:=private.group_recommend(target,uid,'standard')->'ohp'->'sets'->0;
 if r->>'source_id'<>qualified::text or (r->>'weight')::numeric<>40 or (r->>'high_effort_adjustment')::boolean then raise exception 'Qualified RIR or session-RPE separation failed';end if;
 update public.group_classes set movements=jsonb_build_array(movement||'{"record_use":"log_only"}'::jsonb) where id=target;
 if (private.group_recommend(target,uid,'standard')->'ohp'->'sets'->0->>'weight')::numeric<>40 then raise exception 'Log-only target cannot receive recommendation';end if;
 perform set_config('request.jwt.claim.sub',uid::text,true);
 perform set_config('role','authenticated',true);
 h:=public.group_my_history();
 select value into r from jsonb_array_elements(h) where value->>'id'=logged::text;
 if r->'group_classes'->'movements'->0->>'record_use'<>'log_only' or (r->'results'->'ohp'->'sets'->0->>'weight')::numeric<>90 or (r->>'session_rpe')::numeric<>9 then raise exception 'Personal history lost log-only record';end if;
 begin
  perform private.group_recommend(target,uid,'standard');raise exception 'Private recommender exposed';
 exception when insufficient_privilege then null;end;
end $$;
rollback;
select 'PASS: record-use choices, safe default, isolated strength estimate, RPE separation, personal history and permissions; all fixtures rolled back' as result;
