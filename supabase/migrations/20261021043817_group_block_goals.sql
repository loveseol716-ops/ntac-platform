-- Block goals are authoring defaults, not workout prescriptions or strength results.
create table public.group_block_goals (
 block_id text primary key check (block_id ~ '^20[0-9]{2}-(preseason|b0[1-4])$'),
 programs jsonb not null,
 revision integer not null default 1 check (revision > 0),
 updated_by uuid not null references public.profiles(id),
 updated_at timestamptz not null default now()
);
create index group_block_goals_updated_by_idx on public.group_block_goals(updated_by);
alter table public.group_block_goals enable row level security;
revoke all on public.group_block_goals from public,anon,authenticated;
grant select on public.group_block_goals to authenticated;
create policy group_block_goals_staff_read on public.group_block_goals for select to authenticated
 using ((select private.group_staff()));

create function private.group_save_block_goals(payload jsonb) returns jsonb
 language plpgsql security definer set search_path='' as $$
declare bid text := payload->>'block_id'; expected integer;
 kind text; goals jsonb; goal jsonb; clean jsonb := '{}'; items jsonb; saved public.group_block_goals;
begin
 if auth.uid() is null or not coalesce(public.is_ntac_admin(),false) then raise exception '블록 목표 설정은 관리자만 가능해요.'; end if;
 if bid is null or bid !~ '^20[0-9]{2}-(preseason|b0[1-4])$' then raise exception '블록을 선택해 주세요.'; end if;
 if coalesce(payload->>'revision','0') !~ '^[0-9]{1,9}$' then raise exception '설정 버전을 확인해 주세요.'; end if;
 expected := coalesce((payload->>'revision')::integer,0);
 if jsonb_typeof(payload->'programs') is distinct from 'object'
 or exists(select 1 from jsonb_object_keys(payload->'programs') k where k not in ('gentle_strength','bomb_strength')) then raise exception '스트렝스 수업별 목표를 입력해 주세요.'; end if;
 foreach kind in array array['gentle_strength','bomb_strength'] loop
  goals := payload->'programs'->kind;
  if jsonb_typeof(goals) is distinct from 'array' then raise exception '평가 종목 목록을 확인해 주세요.'; end if;
  if jsonb_array_length(goals)>8 then raise exception '수업별 평가 종목은 8개까지 설정할 수 있어요.'; end if;
  items := '[]';
  for goal in select value from jsonb_array_elements(goals) loop
   if jsonb_typeof(goal) is distinct from 'object'
    or not exists(select 1 from public.group_exercises where id=goal->>'exercise_id') then raise exception '등록된 평가 종목을 선택해 주세요.'; end if;
   if jsonb_typeof(goal->'test_reps') is distinct from 'number' or goal->>'test_reps' not in ('1','2','3','5') then raise exception '평가 기준은 1·2·3·5RM 중 선택해 주세요.'; end if;
   if exists(select 1 from jsonb_array_elements(items) x where x->>'exercise_id'=goal->>'exercise_id') then raise exception '같은 평가 종목이 중복됐어요.'; end if;
   items := items || jsonb_build_array(jsonb_build_object('exercise_id',goal->>'exercise_id','test_reps',(goal->>'test_reps')::integer));
  end loop;
  clean := clean || jsonb_build_object(kind,items);
 end loop;
 if expected=0 then
  insert into public.group_block_goals(block_id,programs,updated_by) values(bid,clean,auth.uid())
   on conflict(block_id) do nothing returning * into saved;
 else
  update public.group_block_goals set programs=clean,revision=revision+1,updated_by=auth.uid(),updated_at=now()
   where block_id=bid and revision=expected returning * into saved;
 end if;
 if saved.block_id is null then raise exception '블록 목표가 변경됐어요. 설정을 닫고 새로 불러온 뒤 다시 시도해 주세요.'; end if;
 return to_jsonb(saved);
end $$;
revoke all on function private.group_save_block_goals(jsonb) from public,anon,authenticated;
grant execute on function private.group_save_block_goals(jsonb) to authenticated;
create function public.group_save_block_goals(payload jsonb) returns jsonb
 language sql security invoker set search_path='' as $$ select private.group_save_block_goals(payload); $$;
revoke all on function public.group_save_block_goals(jsonb) from public,anon,authenticated;
grant execute on function public.group_save_block_goals(jsonb) to authenticated;
notify pgrst,'reload schema';

-- Preserve explicit class identity for single-class authoring, including copies.
create or replace function public.group_save_class(payload jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare cid uuid := coalesce(nullif(payload->>'id','')::uuid,gen_random_uuid()); old public.group_classes; coach uuid := (payload->>'coach_id')::uuid;
begin
 if not private.group_staff() then raise exception '코치 권한이 필요해요.'; end if;
 select * into old from public.group_classes where id=cid for update;
 if found then
  if not private.group_manage(cid) then raise exception '담당 수업만 수정할 수 있어요.'; end if;
  if old.revision<>coalesce((payload->>'revision')::integer,0) then raise exception '수업이 변경됐어요. 새로고침 후 다시 시도해 주세요.'; end if;
  if old.archived_at is not null or exists(select 1 from public.group_participants where class_id=cid) or old.status in ('live','ended','cancelled') then raise exception '참가 이후 프로그램은 고정돼요. 새 수업으로 복제해 주세요.'; end if;
 end if;
 if not public.is_ntac_admin() and coach<>auth.uid() then raise exception '본인 담당 수업만 만들 수 있어요.'; end if;
 if coach is null or not exists(select 1 from public.profiles where id=coach and role in ('owner','admin','coach')) then raise exception '담당 코치를 선택해 주세요.'; end if;
 if payload ? 'class_type_id' and payload->>'class_type_id' is not null and not exists(select 1 from public.group_class_types where id=payload->>'class_type_id') then raise exception '수업 종류를 확인해 주세요.'; end if;
 perform private.group_validate_movements(payload->'movements');
 insert into public.group_classes(id,title,starts_at,duration_minutes,coach_id,description,movements,created_by,recording_version,class_type_id)
 values(cid,trim(payload->>'title'),(payload->>'starts_at')::timestamptz,(payload->>'duration_minutes')::integer,coach,coalesce(payload->>'description',''),payload->'movements',auth.uid(),case when payload->>'recording_version'='2' or exists(select 1 from jsonb_array_elements(payload->'movements') m where m->>'training_type'='strength') then 2 else 1 end,case when payload ? 'class_type_id' then payload->>'class_type_id' else old.class_type_id end)
 on conflict(id) do update set class_type_id=excluded.class_type_id,title=excluded.title,starts_at=excluded.starts_at,duration_minutes=excluded.duration_minutes,coach_id=excluded.coach_id,description=excluded.description,movements=excluded.movements,recording_version=greatest(group_classes.recording_version,excluded.recording_version),program_version=group_classes.program_version+1,revision=group_classes.revision+1,updated_at=now();
 insert into public.group_audit(class_id,actor_id,action) values(cid,auth.uid(),'save_program');
 return cid;
end $$;
notify pgrst,'reload schema';
