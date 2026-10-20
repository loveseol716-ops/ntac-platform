-- Separate one weekly program per class type from its recurring calendar occurrences.
create table public.group_class_types (
 id text primary key, name text not null unique, days integer[] not null, sort_order integer not null unique
);
insert into public.group_class_types(id,name,days,sort_order) values
 ('gentle_sweat','GENTLE SWEAT','{2,3}',1),('gentle_strength','GENTLE STRENGTH','{1,5}',2),
 ('bomb_sweat','BOMB SWEAT','{1,5}',3),('bomb_strength','BOMB STRENGTH','{2,3}',4),
 ('you_in','YOU IN','{4}',5),('nolto_team','NOLTO & TEAM','{6}',6),('no_more_weak','NO MORE WEAK','{7}',7);
alter table public.group_class_types enable row level security;
revoke all on public.group_class_types from public,anon,authenticated;
grant select on public.group_class_types to authenticated;
create policy group_class_types_read on public.group_class_types for select to authenticated using(true);
alter table public.group_weeks add column program_mode text not null default 'day' check(program_mode in ('day','class_type'));
alter table public.group_weeks add column programs jsonb not null default '[]' check(jsonb_typeof(programs)='array');
alter table public.group_classes add column class_type_id text references public.group_class_types(id);
create index group_classes_type_idx on public.group_classes(class_type_id);
create function private.group_save_week_days(payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare w public.group_weeks; wid uuid:=coalesce(nullif(payload->>'id','')::uuid,gen_random_uuid()); d jsonb; s jsonb; slots jsonb; days jsonb:=payload->'days';
 day_ids integer[]:='{}'; keep_ids uuid[]:='{}'; ws date:=(payload->>'week_start')::date; nextstate text:=coalesce(payload->>'status','draft');
 c public.group_classes; at_time timestamptz; made integer:=0; changed integer:=0; kept integer:=0;
begin
 if auth.uid() is null or not public.is_ntac_admin() then raise exception '주간 프로그램은 관리자만 만들 수 있어요.'; end if;
 -- Serialize against timetable edits and other weekly publishing operations.
 select t.slots into slots from public.group_timetable t where id for update;
 select * into w from public.group_weeks where id=wid for update;
 if found and (w.revision is distinct from (payload->>'revision')::integer or w.status='archived' or ws is distinct from w.week_start) then raise exception '프로그램이 변경되었거나 보관됐어요. 다시 불러와 주세요.'; end if;
 if ws is null or extract(isodow from ws)<>1 or nextstate not in ('draft','published') or (w.status='published' and nextstate='draft') then raise exception '월요일 시작일과 공개 상태를 확인해 주세요. 공개 프로그램은 삭제로 내릴 수 있어요.'; end if;
 if jsonb_typeof(days) is distinct from 'array' then raise exception '요일별 프로그램을 입력해 주세요.'; end if;
 if jsonb_array_length(days) not between 1 and 7 then raise exception '1~7일의 프로그램을 작성해 주세요.'; end if;
 for d in select value from jsonb_array_elements(days) loop
  if coalesce((d->>'dow')::integer,0) not between 1 and 7 or (d->>'dow')::integer=any(day_ids) or length(trim(coalesce(d->>'title',''))) not between 1 and 120 or length(coalesce(d->>'description',''))>10000 then raise exception '요일·수업 이름·프로그램 설명을 확인해 주세요.'; end if;
  day_ids:=array_append(day_ids,(d->>'dow')::integer);
  perform private.group_validate_movements(d->'movements');
 end loop;
 if nextstate='published' and not exists(select 1 from jsonb_array_elements(slots) x where (x->>'dow')::integer=any(day_ids)) then raise exception '프로그램 요일에 해당하는 반복 시간표를 먼저 등록해 주세요.'; end if;
 insert into public.group_weeks(id,week_start,title,days,status,created_by) values(wid,ws,trim(payload->>'title'),days,nextstate,auth.uid())
 on conflict(id) do update set title=excluded.title,days=excluded.days,status=excluded.status,revision=group_weeks.revision+1,updated_at=now();
 if nextstate='published' then
  for s in select value from jsonb_array_elements(slots) loop
   select value into d from jsonb_array_elements(days) where (value->>'dow')::integer=(s->>'dow')::integer;
   if d is null then continue; end if;
   keep_ids:=array_append(keep_ids,(s->>'id')::uuid);
   at_time:=((ws+(s->>'dow')::integer-1)+(s->>'time')::time) at time zone 'Asia/Seoul';
   select * into c from public.group_classes where week_id=wid and slot_id=(s->>'id')::uuid for update;
   if found then
    if at_time<=now() or c.starts_at<=now() or c.status not in ('draft','published') or c.archived_at is not null or exists(select 1 from public.group_participants where class_id=c.id) then kept:=kept+1;continue;end if;
    update public.group_classes set title=d->>'title',description=coalesce(d->>'description',''),movements=d->'movements',starts_at=at_time,coach_id=(s->>'coach_id')::uuid,duration_minutes=(s->>'duration_minutes')::integer,status='published',program_version=program_version+1,revision=revision+1,updated_at=now() where id=c.id;
    changed:=changed+1;
   elsif at_time>now() then
    insert into public.group_classes(title,description,movements,starts_at,coach_id,duration_minutes,status,created_by,week_id,slot_id,recording_version)
    values(d->>'title',coalesce(d->>'description',''),d->'movements',at_time,(s->>'coach_id')::uuid,(s->>'duration_minutes')::integer,'published',auth.uid(),wid,(s->>'id')::uuid,2);
    made:=made+1;
   end if;
  end loop;
  -- Removed slots/days disappear only if they have never been rostered or started.
  update public.group_classes cl set archived_at=now(),status='cancelled',revision=revision+1,updated_at=now()
  where week_id=wid and not (slot_id=any(keep_ids)) and starts_at>now() and status in ('draft','published') and archived_at is null and not exists(select 1 from public.group_participants p where p.class_id=cl.id);
 end if;
 insert into public.group_audit(actor_id,action,detail) values(auth.uid(),'save_week',jsonb_build_object('week_id',wid,'created',made,'updated',changed,'kept',kept));
 return jsonb_build_object('id',wid,'created',made,'updated',changed,'kept',kept);
end $$;
revoke all on function private.group_save_week_days(jsonb) from public,anon,authenticated;
create function private.group_poster_slots(coach uuid) returns jsonb language sql volatile security invoker set search_path='' as $$
 select jsonb_agg(s||jsonb_build_object('id',gen_random_uuid(),'coach_id',coach) order by n)
 from jsonb_array_elements('[{"dow":1,"time":"07:20","class_type_id":"gentle_strength","duration_minutes":50},{"dow":1,"time":"10:00","class_type_id":"bomb_sweat","duration_minutes":50},{"dow":1,"time":"12:10","class_type_id":"gentle_strength","duration_minutes":50},{"dow":1,"time":"18:20","class_type_id":"gentle_strength","duration_minutes":50},{"dow":1,"time":"19:30","class_type_id":"bomb_sweat","duration_minutes":50},{"dow":1,"time":"20:40","class_type_id":"gentle_strength","duration_minutes":50},{"dow":2,"time":"07:20","class_type_id":"gentle_sweat","duration_minutes":50},{"dow":2,"time":"12:10","class_type_id":"gentle_sweat","duration_minutes":50},{"dow":2,"time":"18:20","class_type_id":"gentle_sweat","duration_minutes":50},{"dow":2,"time":"19:30","class_type_id":"bomb_strength","duration_minutes":50},{"dow":2,"time":"20:40","class_type_id":"gentle_sweat","duration_minutes":50},{"dow":3,"time":"07:20","class_type_id":"bomb_strength","duration_minutes":50},{"dow":3,"time":"10:00","class_type_id":"gentle_sweat","duration_minutes":50},{"dow":3,"time":"12:10","class_type_id":"bomb_strength","duration_minutes":50},{"dow":3,"time":"18:20","class_type_id":"bomb_strength","duration_minutes":50},{"dow":3,"time":"19:30","class_type_id":"gentle_sweat","duration_minutes":50},{"dow":3,"time":"20:40","class_type_id":"bomb_strength","duration_minutes":50},{"dow":4,"time":"19:30","class_type_id":"you_in","duration_minutes":50},{"dow":5,"time":"07:20","class_type_id":"bomb_sweat","duration_minutes":50},{"dow":5,"time":"10:00","class_type_id":"gentle_strength","duration_minutes":50},{"dow":5,"time":"12:10","class_type_id":"bomb_sweat","duration_minutes":50},{"dow":5,"time":"18:20","class_type_id":"bomb_sweat","duration_minutes":50},{"dow":5,"time":"19:30","class_type_id":"gentle_strength","duration_minutes":50},{"dow":5,"time":"20:40","class_type_id":"bomb_sweat","duration_minutes":50},{"dow":6,"time":"10:00","class_type_id":"nolto_team","duration_minutes":50},{"dow":7,"time":"10:00","class_type_id":"no_more_weak","duration_minutes":90}]'::jsonb) with ordinality x(s,n);
$$;
revoke all on function private.group_poster_slots(uuid) from public,anon,authenticated;
create or replace function public.group_save_timetable(payload jsonb, expected_revision integer) returns void language plpgsql security definer set search_path='' as $$
declare old public.group_timetable; s jsonb; ids text[]:='{}'; times text[]:='{}'; key text;
begin
 if auth.uid() is null or not public.is_ntac_admin() then raise exception '시간표는 관리자만 설정할 수 있어요.'; end if;
 select * into old from public.group_timetable where id for update;
 if old.revision is distinct from expected_revision then raise exception '시간표가 변경됐어요. 다시 불러와 주세요.'; end if;
 if jsonb_typeof(payload) is distinct from 'array' then raise exception '시간표 형식을 확인해 주세요.'; end if;
 if jsonb_array_length(payload)>100 then raise exception '시간표는 최대 100개예요.'; end if;
 for s in select value from jsonb_array_elements(payload) loop
  if (s->>'id')::uuid is null or s->>'id'=any(ids) or coalesce((s->>'dow')::integer,0) not between 1 and 7 or coalesce(s->>'time','')!~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' or coalesce((s->>'duration_minutes')::integer,0) not between 10 and 240 or not exists(select 1 from public.profiles where id=(s->>'coach_id')::uuid and role in ('owner','admin','coach')) then raise exception '요일·시간·수업 길이·담당 코치를 확인해 주세요.'; end if;
  if s ? 'class_type_id' then
   if not exists(select 1 from public.group_class_types where id=s->>'class_type_id' and (s->>'dow')::integer=any(days)) then raise exception '수업 종류와 운영 요일을 맞춰 주세요.'; end if;
  elsif exists(select 1 from jsonb_array_elements(old.slots) x where x->>'id'=s->>'id' and x ? 'class_type_id') then
   raise exception '수업 종류가 누락됐어요. 최신 화면에서 다시 저장해 주세요.';
  end if;
  key:=(s->>'dow')||'/'||(s->>'time')||'/'||(s->>'coach_id');
  if key=any(times) then raise exception '같은 시간·코치의 수업이 중복돼요.'; end if;
  ids:=array_append(ids,s->>'id');times:=array_append(times,key);
 end loop;
 update public.group_timetable set slots=payload,revision=revision+1,updated_at=now() where id;
 insert into public.group_audit(actor_id,action,detail) values(auth.uid(),'save_timetable',jsonb_build_object('before',old.slots,'after',payload));
end $$;
create or replace function public.group_save_week(payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare w public.group_weeks; wid uuid:=coalesce(nullif(payload->>'id','')::uuid,gen_random_uuid()); ws date:=(payload->>'week_start')::date;
 nextstate text:=coalesce(payload->>'status','draft'); programs jsonb:=payload->'programs'; clean jsonb:='[]'; p jsonb; s jsonb; t public.group_class_types;
 types text[]:='{}'; ready_ids text[]:='{}'; keep_ids uuid[]:='{}'; tt public.group_timetable; c public.group_classes; at_time timestamptz;
 made integer:=0; changed integer:=0; kept integer:=0; conflicts integer:=0; default_loaded boolean:=false;
begin
 if auth.uid() is null or not public.is_ntac_admin() then raise exception '주간 프로그램은 관리자만 만들 수 있어요.'; end if;
 select * into tt from public.group_timetable where id for update;
 select * into w from public.group_weeks where id=wid for update;
 if coalesce(payload->>'program_mode','day')='day' then
  if w.program_mode='class_type' then raise exception '수업별 주간 프로그램은 최신 화면에서 수정해 주세요.'; end if;
  return private.group_save_week_days(payload);
 end if;
 if payload->>'program_mode'<>'class_type' then raise exception '주간 프로그램 형식을 확인해 주세요.'; end if;
 if w.id is not null and (w.revision is distinct from (payload->>'revision')::integer or w.status='archived' or ws is distinct from w.week_start or w.program_mode<>'class_type') then raise exception '프로그램이 변경되었거나 기존 요일별 형식이에요. 다시 불러와 주세요.'; end if;
 if ws is null or extract(isodow from ws)<>1 or nextstate not in ('draft','published') or (w.status='published' and nextstate='draft') then raise exception '주차와 공개 상태를 확인해 주세요.'; end if;
 if jsonb_typeof(programs) is distinct from 'array' then raise exception '수업별 프로그램을 입력해 주세요.'; end if;
 if jsonb_array_length(programs)<>7 then raise exception '7개 수업을 한 주의 묶음으로 저장해 주세요.'; end if;
 for p in select value from jsonb_array_elements(programs) loop
  select * into t from public.group_class_types where id=p->>'class_type_id';
  if not found or t.id=any(types) or length(coalesce(p->>'description',''))>10000 then raise exception '수업 종류가 중복되거나 올바르지 않아요.'; end if;
  types:=array_append(types,t.id);
  perform private.group_validate_movements(p->'movements');
  if length(trim(coalesce(p->>'description','')))>0 or jsonb_array_length(p->'movements')>0 then ready_ids:=array_append(ready_ids,t.id);end if;
  clean:=clean||jsonb_build_array(jsonb_build_object('class_type_id',t.id,'title',t.name,'description',coalesce(p->>'description',''),'movements',p->'movements'));
 end loop;
 if nextstate='published' then
  if cardinality(ready_ids)=0 then raise exception '최소 한 수업의 프로그램을 작성해 주세요.'; end if;
  if jsonb_array_length(tt.slots)=0 then
   perform public.group_save_timetable(private.group_poster_slots(auth.uid()),tt.revision);
   select * into tt from public.group_timetable where id;default_loaded:=true;
  end if;
  if exists(select 1 from jsonb_array_elements(tt.slots) x where not exists(select 1 from public.group_class_types ct where ct.id=x->>'class_type_id' and (x->>'dow')::integer=any(ct.days))) then raise exception '시간표의 각 시간에 수업 종류를 연결해 주세요.'; end if;
  if exists(select 1 from unnest(ready_ids) r where not exists(select 1 from jsonb_array_elements(tt.slots) x where x->>'class_type_id'=r)) then raise exception '작성한 수업에 연결된 시간이 없어요. 시간표를 확인해 주세요.'; end if;
 end if;
 insert into public.group_weeks(id,week_start,title,days,status,created_by,program_mode,programs)
 values(wid,ws,trim(payload->>'title'),'[]',nextstate,auth.uid(),'class_type',clean)
 on conflict(id) do update set title=excluded.title,programs=excluded.programs,status=excluded.status,revision=group_weeks.revision+1,updated_at=now();
 if nextstate='published' then
  select coalesce(array_agg((x->>'id')::uuid),'{}'::uuid[]) into keep_ids
  from jsonb_array_elements(tt.slots) x where x->>'class_type_id'=any(ready_ids);
  -- Retire replaced empty slots first, so their old times cannot block new slot IDs.
  -- Rostered/started occurrences remain and are counted as conflicts instead.
  update public.group_classes cl set archived_at=now(),status='cancelled',revision=revision+1,updated_at=now()
  where week_id=wid and not(slot_id=any(keep_ids)) and starts_at>now() and status in ('draft','published') and archived_at is null and not exists(select 1 from public.group_participants gp where gp.class_id=cl.id);
  for s in select value from jsonb_array_elements(tt.slots) loop
   if not(s->>'class_type_id'=any(ready_ids)) then continue;end if;
   select value into p from jsonb_array_elements(clean) where value->>'class_type_id'=s->>'class_type_id';
   at_time:=((ws+(s->>'dow')::integer-1)+(s->>'time')::time) at time zone 'Asia/Seoul';
   select * into c from public.group_classes where week_id=wid and slot_id=(s->>'id')::uuid for update;
   if found then
    if at_time<=now() or c.starts_at<=now() or c.status not in ('draft','published') or c.archived_at is not null or exists(select 1 from public.group_participants where class_id=c.id) then kept:=kept+1;continue;end if;
    if exists(select 1 from public.group_classes cl where cl.id<>c.id and cl.starts_at=at_time and cl.coach_id=(s->>'coach_id')::uuid and cl.archived_at is null and cl.status<>'cancelled') then conflicts:=conflicts+1;continue;end if;
    update public.group_classes set title=p->>'title',description=p->>'description',movements=p->'movements',class_type_id=p->>'class_type_id',starts_at=at_time,coach_id=(s->>'coach_id')::uuid,duration_minutes=(s->>'duration_minutes')::integer,status='published',program_version=program_version+1,revision=revision+1,updated_at=now() where id=c.id;
    changed:=changed+1;
   elsif at_time>now() then
    if exists(select 1 from public.group_classes cl where cl.starts_at=at_time and cl.coach_id=(s->>'coach_id')::uuid and cl.archived_at is null and cl.status<>'cancelled') then conflicts:=conflicts+1;continue;end if;
    insert into public.group_classes(title,description,movements,class_type_id,starts_at,coach_id,duration_minutes,status,created_by,week_id,slot_id,recording_version)
    values(p->>'title',p->>'description',p->'movements',p->>'class_type_id',at_time,(s->>'coach_id')::uuid,(s->>'duration_minutes')::integer,'published',auth.uid(),wid,(s->>'id')::uuid,2);
    made:=made+1;
   end if;
  end loop;
 end if;
 insert into public.group_audit(actor_id,action,detail) values(auth.uid(),'save_class_type_week',jsonb_build_object('week_id',wid,'ready_types',ready_ids,'created',made,'updated',changed,'kept',kept,'conflicts',conflicts));
 return jsonb_build_object('id',wid,'created',made,'updated',changed,'kept',kept,'conflicts',conflicts,'default_timetable_loaded',default_loaded);
end $$;
notify pgrst,'reload schema';
