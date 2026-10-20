-- Cached legacy clients may create legacy classes until their app update is installed.
-- Explicit new clients and strength prescriptions use the final-RPE recording flow.
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
 perform private.group_validate_movements(payload->'movements');
 insert into public.group_classes(id,title,starts_at,duration_minutes,coach_id,description,movements,created_by,recording_version)
 values(cid,trim(payload->>'title'),(payload->>'starts_at')::timestamptz,(payload->>'duration_minutes')::integer,coach,coalesce(payload->>'description',''),payload->'movements',auth.uid(),case when payload->>'recording_version'='2' or exists(select 1 from jsonb_array_elements(payload->'movements') m where m->>'training_type'='strength') then 2 else 1 end)
 on conflict(id) do update set title=excluded.title,starts_at=excluded.starts_at,duration_minutes=excluded.duration_minutes,coach_id=excluded.coach_id,description=excluded.description,movements=excluded.movements,recording_version=greatest(group_classes.recording_version,excluded.recording_version),program_version=group_classes.program_version+1,revision=group_classes.revision+1,updated_at=now();
 insert into public.group_audit(class_id,actor_id,action) values(cid,auth.uid(),'save_program');
 return cid;
end $$;
notify pgrst,'reload schema';
