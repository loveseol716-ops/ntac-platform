-- All synthetic classes, membership/visibility overrides and display tokens roll back.
begin;
do $$
declare aid uuid; uid uuid; sid uuid; cid uuid:=gen_random_uuid(); pid uuid; rev integer; wall jsonb; shown jsonb; rec jsonb; exercise text;
begin
 select id into aid from public.profiles where role in ('owner','admin') order by id limit 1;
 select id into uid from public.profiles where role='member' order by id limit 1;
 select id into sid from public.profiles where role='member' and id<>uid order by id limit 1;
 select id into exercise from public.group_exercises order by id limit 1;
 if aid is null or uid is null or sid is null then raise exception 'Missing smoke prerequisites'; end if;
 insert into public.group_members(user_id,active,nickname,show_on_tv) values(uid,true,'AUTO SMOKE',true),(sid,true,'PRIVATE SMOKE',false)
 on conflict(user_id) do update set active=excluded.active,nickname=excluded.nickname,show_on_tv=excluded.show_on_tv;
 insert into public.group_classes(id,title,starts_at,duration_minutes,coach_id,created_by,status,movements)
 values(cid,'ROLLBACK AUTO FLOW',now(),10,aid,aid,'published',jsonb_build_array(jsonb_build_object('id','test','exercise_id',exercise,'kind','weight','unit','kg','load_basis','total','target_reps',5)));
 perform set_config('request.jwt.claim.sub',aid::text,true);
 perform set_config('role','authenticated',true);
 wall:=public.group_create_wall('ROLLBACK AUTO TV');
 perform public.group_join(cid,array[sid]);
 perform set_config('request.jwt.claim.sub',uid::text,true);
 perform public.group_join(cid);
 perform public.group_join(cid);
 rec:=public.group_detail(cid);
 if rec->'class'->>'status'<>'live' or rec->'class'->>'stored_status'<>'published' then raise exception 'Scheduled class did not start'; end if;
 if jsonb_array_length(rec->'participants')<>1 then raise exception 'Duplicate entry or private roster leak'; end if;
 pid:=(rec->'participants'->0->>'id')::uuid;
 rev:=(rec->'participants'->0->>'revision')::int;
 perform public.group_save_participant(pid,rev,jsonb_build_object('status','completed','results',jsonb_build_object('test',jsonb_build_object('weight',30,'reps',5)),'session_rpe',7));
 perform set_config('role','anon',true);
 perform set_config('request.jwt.claim.sub','',true);
 shown:=public.group_display(wall->>'results');
 if shown->'class'->>'id'<>cid::text or not (shown->>'automatic')::boolean then raise exception 'TV did not automatically select class'; end if;
 if jsonb_array_length(shown->'participants')<>1 or shown->'participants'->0->>'name'<>'AUTO SMOKE' then raise exception 'TV privacy failed'; end if;
 if shown->'participants'->0->'results'->'test'->>'weight'<>'30' then raise exception 'Actual record absent from screen'; end if;
 rec:=public.group_display(wall->>'recommendations');
 if rec->'class'->>'id'<>shown->'class'->>'id' or rec->>'movement_id'<>shown->>'movement_id' then raise exception 'Screens not synchronized'; end if;
 if rec->'participants'->0->>'results' is not null then raise exception 'Recommendation screen leaked results'; end if;
 if has_function_privilege('anon','private.group_display_class(timestamptz)','execute') then raise exception 'Private selector exposed'; end if;
 perform set_config('role','authenticated',true);
 perform set_config('request.jwt.claim.sub',aid::text,true);
 perform public.group_control_wall((wall->>'id')::uuid,null,null,true);
 begin
  perform public.group_display(wall->>'results');raise exception 'Revoked display still works';
 exception when raise_exception then if SQLERRM not like 'TV 연결이 해제됐거나%' then raise;end if;end;
end $$;
rollback;
select 'PASS: server clock, member and coach entry, duplicate prevention, actual record saving, two automatic screens, privacy and token revocation; rolled back' as result;
