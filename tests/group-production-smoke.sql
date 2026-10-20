-- Rollback-only integration test against the existing production schema and RLS.
-- Uses existing IDs internally; no member information is returned or changed permanently.
begin;
do $$
declare aid uuid; uid uuid; oid uuid; cid uuid; pid uuid; movement jsonb; detail jsonb; wall jsonb; screen jsonb; before_pt bigint; before_events bigint; before_ntac bigint;
begin
 select id into aid from public.profiles where role in ('owner','admin') order by id limit 1;
 select id into uid from public.profiles where role='member' order by id limit 1;
 select id into oid from public.profiles where role='member' and id<>uid order by id limit 1;
 if aid is null or uid is null or oid is null then raise exception 'Test needs an admin and two existing member profiles'; end if;
 select count(*) into before_pt from public.pt_sessions; select count(*) into before_events from public.pt_pass_events;select count(*) into before_ntac from public.workout_records;
 perform set_config('request.jwt.claim.sub',aid::text,true); perform set_config('role','authenticated',true);
 perform public.group_set_member(uid,true);perform public.group_set_member(oid,true);
 movement:=jsonb_build_array(jsonb_build_object('id','test-squat','exercise_id','back_squat','label','ROLLBACK ONLY','kind','weight','target_reps',8,'unit','kg','load_basis','total'));
 cid:=public.group_save_class(jsonb_build_object('title','ROLLBACK GROUP TEST','starts_at',((now() at time zone 'Asia/Seoul')::date + time '00:00') at time zone 'Asia/Seoul','duration_minutes',50,'coach_id',aid,'description','ROLLBACK ONLY','movements',movement));
 perform public.group_set_class_status(cid,'published',1);perform public.group_set_class_status(cid,'open',2);
 perform public.group_set_baseline(jsonb_build_object('user_id',uid,'exercise_id','back_squat','target_reps',8,'unit','kg','load_basis','total','difficulty','standard','weight',20,'reason','ROLLBACK ONLY'));
 perform set_config('request.jwt.claim.sub',uid::text,true);
 perform public.group_join(cid);perform public.group_join(cid);
 detail:=public.group_detail(cid);pid:=(detail->'participants'->0->>'id')::uuid;
 if jsonb_array_length(detail->'participants')<>1 then raise exception 'Duplicate join';end if;
 perform public.group_set_privacy('ROLLBACK NICKNAME',true);
 perform public.group_save_participant(pid,1,jsonb_build_object('status','completed'));
 if (select results from public.group_participants where id=pid)<>'{}'::jsonb then raise exception 'Completion fabricated a result';end if;
 perform set_config('request.jwt.claim.sub',oid::text,true);
 if exists(select 1 from public.group_participants where id=pid) then raise exception 'Member RLS leak';end if;
 begin perform public.group_save_participant(pid,2,jsonb_build_object('status','cancelled'));raise exception 'Missing member write guard'; exception when raise_exception then if SQLERRM not like '본인 또는 담당 코치%' then raise;end if;end;
 perform set_config('request.jwt.claim.sub',aid::text,true);
 wall:=public.group_create_wall('ROLLBACK TV');perform public.group_control_wall((wall->>'id')::uuid,cid,'test-squat');
 perform set_config('request.jwt.claim.sub','',true);perform set_config('role','anon',true);
 screen:=public.group_display(wall->>'recommendations');
 if jsonb_array_length(screen->'participants')<>1 or screen->'participants'->0->>'name'<>'ROLLBACK NICKNAME' then raise exception 'TV sanitized projection mismatch';end if;
 if screen::text like '%'||uid::text||'%' then raise exception 'TV identity leak';end if;
 begin perform public.group_join(cid);raise exception 'Anonymous mutation permitted';exception when insufficient_privilege then null;end;
 perform set_config('role','none',true);perform set_config('request.jwt.claim.sub',aid::text,true);
 if (select count(*) from public.pt_sessions)<>before_pt or (select count(*) from public.pt_pass_events)<>before_events or (select count(*) from public.workout_records)<>before_ntac then raise exception 'Legacy records changed';end if;
end $$;
rollback;
select 'PASS: production group lifecycle, role grants, own-record RLS, TV projection, no PT/NTAC writes; all test changes rolled back' as result;
