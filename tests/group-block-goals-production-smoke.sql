-- Rollback-only verification; no configured goals, classes or member data persist.
begin;
do $$
declare aid uuid; uid uuid; coach uuid; exercise text; saved jsonb; goals jsonb; rev integer; cid uuid; old_movements jsonb;
begin
 select id into aid from public.profiles where role in ('owner','admin') order by id limit 1;
 select id into uid from public.profiles where role='member' order by id limit 1;
 select id into coach from public.profiles where role='coach' order by id limit 1;
 select id into exercise from public.group_exercises order by id limit 1;
 if aid is null or uid is null or exercise is null then raise exception 'Smoke fixture prerequisites missing';end if;
 select revision into rev from public.group_block_goals where block_id='2099-b04';
 perform set_config('request.jwt.claim.sub',aid::text,true);
 perform set_config('role','authenticated',true);
 goals:=jsonb_build_object('gentle_strength',jsonb_build_array(jsonb_build_object('exercise_id',exercise,'test_reps',5)),'bomb_strength','[]'::jsonb);
 saved:=public.group_save_block_goals(jsonb_build_object('block_id','2099-b04','revision',coalesce(rev,0),'programs',goals));
 if saved->'programs' is distinct from goals then raise exception 'Goals round trip failed';end if;
 begin
  perform public.group_save_block_goals(jsonb_build_object('block_id','2099-b04','revision',coalesce(rev,0),'programs',goals));
  raise exception 'Stale revision accepted';
 exception when raise_exception then if SQLERRM not like '블록 목표가 변경%' then raise;end if;end;
 cid:=public.group_save_class(jsonb_build_object('title','ROLLBACK BLOCK GOALS','starts_at',now()+interval '1 hour','duration_minutes',50,'coach_id',aid,'class_type_id','gentle_strength','movements','[]'::jsonb));
 if (select class_type_id from public.group_classes where id=cid) is distinct from 'gentle_strength' then raise exception 'Class identity missing';end if;
 saved:=public.group_save_block_goals(jsonb_build_object('block_id','2099-b04','revision',(saved->>'revision')::integer,'programs',jsonb_build_object('gentle_strength','[]'::jsonb,'bomb_strength','[]'::jsonb)));
 if (select movements from public.group_classes where id=cid) is distinct from '[]'::jsonb then raise exception 'Block config rewrote lesson';end if;
 if coach is not null then
  perform set_config('request.jwt.claim.sub',coach::text,true);
  if not exists(select 1 from public.group_block_goals where block_id='2099-b04') then raise exception 'Coach cannot read goals';end if;
  begin
   perform public.group_save_block_goals(jsonb_build_object('block_id','2099-b04','revision',(saved->>'revision')::integer,'programs',goals));raise exception 'Coach changed agreed goals';
  exception when raise_exception then if SQLERRM not like '블록 목표 설정은 관리자%' then raise;end if;end;
 end if;
 perform set_config('request.jwt.claim.sub',uid::text,true);
 if exists(select 1 from public.group_block_goals) then raise exception 'Member can read staff configuration';end if;
 begin
  perform public.group_save_block_goals(jsonb_build_object('block_id','2099-b04','programs',goals));raise exception 'Member wrote goals';
 exception when raise_exception then if SQLERRM not like '블록 목표 설정은 관리자%' then raise;end if;end;
 begin
  update public.group_block_goals set revision=100 where block_id='2099-b04';raise exception 'Direct table write allowed';
 exception when insufficient_privilege then null;end;
 if has_function_privilege('anon','public.group_save_block_goals(jsonb)','execute') then raise exception 'Anonymous RPC exposed';end if;
end $$;
rollback;
select 'PASS: block goals save/read, revision conflicts, staff/member boundaries, unchanged lessons, class identity; all fixtures rolled back' as result;
