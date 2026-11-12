begin;
do $$
declare aid uuid; uid uuid; other_uid uuid; cid uuid:=gen_random_uuid(); pid uuid; result jsonb; full_history jsonb; n integer; fixture_count integer:=0;
begin
 select id into aid from public.profiles where role in ('owner','admin') order by id limit 1;
 select id into uid from public.profiles where role='member' order by id limit 1;
 select id into other_uid from public.profiles where role='member' and id<>uid order by id limit 1;
 if aid is null or uid is null or other_uid is null then raise exception 'Need two members and an administrator';end if;
 insert into public.group_classes(id,title,starts_at,coach_id,created_by,status,description,movements)
 values(cid,'ROLLBACK PERSONAL HISTORY',now()-interval '400 days',aid,aid,'ended','NEVER EXPOSE PROGRAM BODY','[{"id":"history-sq","exercise_id":"back_squat","label":"Historical Squat","kind":"weight","training_type":"strength","unit":"kg","sets":[{"reps":8,"rir":2}]}]');
 insert into public.group_participants(class_id,user_id,status,results,session_rpe,note) values(cid,uid,'completed','{"history-sq":{"sets":[{"weight":40,"reps":8,"rir":2}]}}',7,'PERSONAL NOTE') returning id into pid;
 insert into public.group_last_sets(participant_id,movement_id,class_id,user_id,exercise_id,set_index,weight,reps,rpe) values(pid,'history-sq',cid,uid,'back_squat',1,40,8,8);
 perform set_config('request.jwt.claim.sub',uid::text,true);
 perform set_config('role','authenticated',true);
 full_history:=public.group_training_history(null,'back_squat',0);
 -- Find the old fixture across pages, rather than assuming no real member history.
 n:=0;
 loop
  full_history:=public.group_training_history(null,'back_squat',n);
  select value into result from jsonb_array_elements(full_history->'records') where value->>'id'=pid::text;
  exit when result is not null or not (full_history->>'has_more')::boolean;
  n:=n+50;
 end loop;
 if result is null or (result->'last_sets'->'history-sq'->>'rpe')::numeric<>8 or (result->>'session_rpe')::numeric<>7 then raise exception 'Own history lost old lift/RPE record';end if;
 if result::text like '%NEVER EXPOSE%' or result::text like '%key_description%' or result->'group_classes'->'movements'->0 ? 'sets' then raise exception 'History exposed expired program data';end if;
 begin
  perform public.group_training_history(other_uid,null,0);raise exception 'OTHER MEMBER ALLOWED';
 exception when raise_exception then if SQLERRM not like '본인 또는 관리자%' then raise;end if;end;
 perform set_config('request.jwt.claim.sub',aid::text,true);
 full_history:=public.group_training_history(uid,'back_squat',n);
 if not exists(select 1 from jsonb_array_elements(full_history->'records') r where r->>'id'=pid::text) then raise exception 'Administrator cannot access member history';end if;
 full_history:=public.group_training_history(uid,'power_clean',0);
 if exists(select 1 from jsonb_array_elements(full_history->'records') r where r->>'id'=pid::text) then raise exception 'Exercise filter ignored';end if;
 perform set_config('role','postgres',true);
 with made as (
  insert into public.group_classes(title,starts_at,coach_id,created_by,status,movements)
  select 'ROLLBACK HISTORY PAGE',now()-interval '2000 days'-make_interval(days=>i),aid,aid,'ended','[{"id":"page-row","exercise_id":"pendlay_row","label":"Pagination lift","kind":"weight","unit":"kg","training_type":"strength"}]'::jsonb
  from generate_series(1,205) i returning id
 ) insert into public.group_participants(class_id,user_id,status,results)
 select id,uid,'completed','{"page-row":{"sets":[{"weight":25,"reps":5,"rir":2}]}}'::jsonb from made;
 perform set_config('request.jwt.claim.sub',uid::text,true);
 perform set_config('role','authenticated',true);
 n:=0;
 loop
  full_history:=public.group_training_history(null,'pendlay_row',n);
  if jsonb_array_length(full_history->'records')>50 then raise exception 'Unbounded history response';end if;
  fixture_count:=fixture_count+(select count(*) from jsonb_array_elements(full_history->'records') r where r->'group_classes'->>'title'='ROLLBACK HISTORY PAGE');
  exit when not (full_history->>'has_more')::boolean;
  n:=n+50;
 end loop;
 if fixture_count<>205 then raise exception 'History still capped or pagination lost records: %',fixture_count;end if;
 perform set_config('request.jwt.claim.sub','',true);
 begin
  perform public.group_training_history(uid,null,0);raise exception 'NO AUTH ALLOWED';
 exception when raise_exception then if SQLERRM not like '로그인%' then raise;end if;end;
end $$;
rollback;
select 'PASS: self/admin history, historical retention, per-lift filter, set/session RPE and blocked peer/anonymous access; rollback only' as result;
