-- Add weekly programming and set-based strength records without changing NTAC/PT data.
alter table public.group_templates add column archived_at timestamptz;
alter table public.group_classes add column archived_at timestamptz;
alter table public.group_classes add column recording_version integer not null default 1;
alter table public.group_participants drop constraint group_participants_status_check;
alter table public.group_participants add constraint group_participants_status_check check(status in ('planned','active','completed','left','cancelled'));
alter table public.group_participants add column session_rpe numeric check(session_rpe between 0 and 10);
create table public.group_timetable (
 id boolean primary key default true check(id), slots jsonb not null default '[]', revision integer not null default 1,
 updated_at timestamptz not null default now()
);
insert into public.group_timetable(id) values(true);
create table public.group_weeks (
 id uuid primary key default gen_random_uuid(), week_start date not null check(extract(isodow from week_start)=1),
 title text not null check(length(trim(title)) between 1 and 120), days jsonb not null default '[]',
 status text not null default 'draft' check(status in ('draft','published','archived')), revision integer not null default 1,
 created_by uuid not null references public.profiles(id), updated_at timestamptz not null default now()
);
create unique index group_weeks_active_date_idx on public.group_weeks(week_start) where status<>'archived';
create index group_weeks_creator_idx on public.group_weeks(created_by);
alter table public.group_classes add column week_id uuid references public.group_weeks(id);
alter table public.group_classes add column slot_id uuid;
create unique index group_classes_week_slot_idx on public.group_classes(week_id,slot_id);
create table public.group_strength_maxes (
 user_id uuid not null references public.profiles(id), exercise_id text not null references public.group_exercises(id),
 unit text not null check(unit in ('kg','lb')), load_basis text not null check(load_basis in ('total','each')),
 weight numeric not null check(weight>0 and weight<=2000), measured_on date not null,
 basis text not null check(basis in ('measured','estimated')), reason text not null check(length(trim(reason)) between 1 and 300),
 updated_by uuid not null references public.profiles(id), updated_at timestamptz not null default now(),
 primary key(user_id,exercise_id,unit,load_basis)
);
create index group_strength_maxes_exercise_idx on public.group_strength_maxes(exercise_id);
create index group_strength_maxes_updater_idx on public.group_strength_maxes(updated_by);
alter table public.group_timetable enable row level security;
alter table public.group_weeks enable row level security;
alter table public.group_strength_maxes enable row level security;
revoke all on public.group_timetable,public.group_weeks,public.group_strength_maxes from public,anon,authenticated;
grant select on public.group_timetable,public.group_weeks,public.group_strength_maxes to authenticated;
create policy group_timetable_read on public.group_timetable for select to authenticated using((select private.group_staff()));
create policy group_weeks_read on public.group_weeks for select to authenticated using((select private.group_staff()) or (status='published' and exists(select 1 from public.group_members where user_id=(select auth.uid()) and active)));
create policy group_maxes_read on public.group_strength_maxes for select to authenticated using(user_id=(select auth.uid()) or (select public.is_ntac_admin()));
create or replace function private.group_access(cid uuid) returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and (private.group_manage(cid) or exists(select 1 from public.group_participants where class_id=cid and user_id=auth.uid()) or (exists(select 1 from public.group_members where user_id=auth.uid() and active) and exists(select 1 from public.group_classes where id=cid and status<>'draft' and archived_at is null)));
$$;
create or replace function private.group_validate_movements(items jsonb) returns void language plpgsql security invoker set search_path='' as $$
declare m jsonb; s jsonb; ids text[] := '{}';
begin
 if items is null or jsonb_typeof(items)<>'array' or jsonb_array_length(items)>20 then raise exception '핵심 운동은 최대 20개까지 등록할 수 있어요.'; end if;
 for m in select value from jsonb_array_elements(items) loop
  if length(coalesce(m->>'id','')) not between 1 and 80 or m->>'id' in ('__proto__','constructor','prototype') or m->>'id'=any(ids) or not exists(select 1 from public.group_exercises where id=m->>'exercise_id') then raise exception '운동 ID와 표준 종목을 확인해 주세요.'; end if;
  if m ? 'training_type' and coalesce(m->>'training_type','') not in ('strength','conditioning','other') then raise exception '운동 구분을 확인해 주세요.'; end if;
  if m->>'training_type'='strength' then
   if m->>'kind'<>'weight' or jsonb_typeof(m->'sets') is distinct from 'array' then raise exception '스트렝스는 세트별 반복 수와 RIR이 필요해요.'; end if;
   if jsonb_array_length(m->'sets') not between 1 and 12 or coalesce((m->>'load_step')::numeric,0) not between 0.25 and 100 or coalesce((m->>'min_load')::numeric,-1) not between 0 and 2000 then raise exception '세트 수·중량 간격·최소 중량을 확인해 주세요.'; end if;
   for s in select value from jsonb_array_elements(m->'sets') loop
    if jsonb_typeof(s->'reps') is distinct from 'number' or coalesce((s->>'reps')::numeric,0) not between 1 and 30 or (s->>'reps')::numeric<>trunc((s->>'reps')::numeric) or jsonb_typeof(s->'rir') is distinct from 'number' or coalesce((s->>'rir')::numeric,-1) not between 0 and 5 then raise exception '반복 수는 1~30회, RIR은 0~5로 입력해 주세요.'; end if;
   end loop;
  elsif m ? 'sets' then raise exception '세트별 추천은 스트렝스에서만 사용해 주세요.';
  end if;
  ids:=array_append(ids,m->>'id');
  if coalesce(m->>'kind','') not in ('weight','time','rounds','distance','calories','participation') or coalesce(m->>'unit','') not in ('kg','lb','s','m','cal','reps') or coalesce(m->>'load_basis','') not in ('total','each','bodyweight') then raise exception '운동 기록 형식을 확인해 주세요.'; end if;
  if m->>'kind'='weight' and ((m->>'unit') not in ('kg','lb') or (m->>'load_basis') not in ('total','each') or coalesce((m->>'target_reps')::integer,0) not between 1 and 1000) then raise exception '중량 운동은 단위·중량 기준·목표 횟수를 입력해 주세요.'; end if;
  if (m->>'kind'='time' and m->>'unit'<>'s') or (m->>'kind'='distance' and m->>'unit'<>'m') or (m->>'kind'='calories' and m->>'unit'<>'cal') or (m->>'kind' in ('rounds','participation') and m->>'unit'<>'reps') then raise exception '기록 형식과 단위를 맞춰 주세요.'; end if;
  if length(coalesce(m->>'label',''))>100 then raise exception '운동 이름이 너무 길어요.'; end if;
 end loop;
end $$;
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
 values(cid,trim(payload->>'title'),(payload->>'starts_at')::timestamptz,(payload->>'duration_minutes')::integer,coach,coalesce(payload->>'description',''),payload->'movements',auth.uid(),2)
 on conflict(id) do update set title=excluded.title,starts_at=excluded.starts_at,duration_minutes=excluded.duration_minutes,coach_id=excluded.coach_id,description=excluded.description,movements=excluded.movements,program_version=group_classes.program_version+1,revision=group_classes.revision+1,updated_at=now();
 insert into public.group_audit(class_id,actor_id,action) values(cid,auth.uid(),'save_program');
 return cid;
end $$;

create function public.group_save_timetable(payload jsonb, expected_revision integer) returns void language plpgsql security definer set search_path='' as $$
declare old public.group_timetable; s jsonb; ids text[]:='{}'; times text[]:='{}'; key text;
begin
 if auth.uid() is null or not public.is_ntac_admin() then raise exception '시간표는 관리자만 설정할 수 있어요.'; end if;
 select * into old from public.group_timetable where id for update;
 if old.revision is distinct from expected_revision then raise exception '시간표가 변경됐어요. 다시 불러와 주세요.'; end if;
 if jsonb_typeof(payload) is distinct from 'array' then raise exception '시간표 형식을 확인해 주세요.'; end if;
 if jsonb_array_length(payload)>100 then raise exception '시간표는 최대 100개예요.'; end if;
 for s in select value from jsonb_array_elements(payload) loop
  if (s->>'id')::uuid is null or s->>'id'=any(ids) or coalesce((s->>'dow')::integer,0) not between 1 and 7 or coalesce(s->>'time','')!~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' or coalesce((s->>'duration_minutes')::integer,0) not between 10 and 240 or not exists(select 1 from public.profiles where id=(s->>'coach_id')::uuid and role in ('owner','admin','coach')) then raise exception '요일·시간·수업 길이·담당 코치를 확인해 주세요.'; end if;
  key:=(s->>'dow')||'/'||(s->>'time')||'/'||(s->>'coach_id');
  if key=any(times) then raise exception '같은 시간·코치의 수업이 중복돼요.'; end if;
  ids:=array_append(ids,s->>'id');times:=array_append(times,key);
 end loop;
 update public.group_timetable set slots=payload,revision=revision+1,updated_at=now() where id;
 insert into public.group_audit(actor_id,action,detail) values(auth.uid(),'save_timetable',jsonb_build_object('before',old.slots,'after',payload));
end $$;

-- Publishing materializes real class rows, so every device sees the same calendar.
-- Stable week/slot keys make repeated publication idempotent. Started/rostered classes are frozen.
create function public.group_save_week(payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
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

create function public.group_remove_program(kind text, target_id uuid, expected_revision integer default null) returns void language plpgsql security definer set search_path='' as $$
declare c public.group_classes; w public.group_weeks;
begin
 if auth.uid() is null then raise exception '로그인이 필요해요.'; end if;
 if kind='class' then
  if not private.group_manage(target_id) then raise exception '담당 수업만 삭제할 수 있어요.'; end if;
  select * into c from public.group_classes where id=target_id for update;
  if c.revision is distinct from expected_revision then raise exception '수업이 변경됐어요. 다시 불러와 주세요.'; end if;
  if c.status='live' then raise exception '진행 중인 수업은 먼저 종료해 주세요.'; end if;
  update public.group_classes set archived_at=now(),status=case when status='ended' then status else 'cancelled' end,revision=revision+1,updated_at=now() where id=target_id;
  update public.group_participants set status='cancelled',revision=revision+1,updated_at=now() where class_id=target_id and status='planned';
  insert into public.group_audit(class_id,actor_id,action,detail) values(target_id,auth.uid(),'archive_class',to_jsonb(c));
 elsif kind='template' then
  if not private.group_staff() or not exists(select 1 from public.group_templates where id=target_id and (created_by=auth.uid() or public.is_ntac_admin())) then raise exception '본인이 만든 템플릿만 삭제할 수 있어요.'; end if;
  update public.group_templates set archived_at=now() where id=target_id;
 elsif kind='week' then
  if not public.is_ntac_admin() then raise exception '관리자만 주간 프로그램을 삭제할 수 있어요.'; end if;
  -- Match publisher lock order.
  perform 1 from public.group_timetable where id for update;
  select * into w from public.group_weeks where id=target_id for update;
  if w.revision is distinct from expected_revision then raise exception '주간 프로그램이 변경됐어요. 다시 불러와 주세요.'; end if;
  update public.group_weeks set status='archived',revision=revision+1,updated_at=now() where id=target_id;
  for c in select * from public.group_classes where week_id=target_id and status in ('draft','published') and starts_at>now() and archived_at is null order by id for update loop
   update public.group_classes set archived_at=now(),status='cancelled',revision=revision+1,updated_at=now() where id=c.id;
   update public.group_participants set status='cancelled',revision=revision+1,updated_at=now() where class_id=c.id and status='planned';
  end loop;
  insert into public.group_audit(actor_id,action,detail) values(auth.uid(),'archive_week',jsonb_build_object('before',to_jsonb(w)));
 else raise exception '삭제할 프로그램 종류를 확인해 주세요.'; end if;
end $$;

create function public.group_set_strength_max(payload jsonb) returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not public.is_ntac_admin() then raise exception '1RM 기준은 관리자만 설정할 수 있어요.'; end if;
 if (payload->>'measured_on')::date>(now() at time zone 'Asia/Seoul')::date then raise exception '측정일은 오늘까지 입력할 수 있어요.'; end if;
 insert into public.group_strength_maxes(user_id,exercise_id,unit,load_basis,weight,measured_on,basis,reason,updated_by)
 values((payload->>'user_id')::uuid,payload->>'exercise_id',payload->>'unit',payload->>'load_basis',(payload->>'weight')::numeric,(payload->>'measured_on')::date,payload->>'basis',payload->>'reason',auth.uid())
 on conflict(user_id,exercise_id,unit,load_basis) do update set weight=excluded.weight,measured_on=excluded.measured_on,basis=excluded.basis,reason=excluded.reason,updated_by=auth.uid(),updated_at=now();
 insert into public.group_audit(actor_id,action,detail) values(auth.uid(),'strength_max',payload);
end $$;
create or replace function private.group_recommend_legacy(cid uuid, uid uuid, level text) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare m jsonb; c public.group_classes; answer jsonb := '{}'; w numeric; source text; source_id uuid;
begin
 select * into c from public.group_classes where id=cid;
 for m in select value from jsonb_array_elements(c.movements) loop
  w:=null; source:='coach_required'; source_id:=null;
  if m->>'kind'='weight' then
   select (r.value->>'weight')::numeric,p.id into w,source_id
   from public.group_participants p join public.group_classes pc on pc.id=p.class_id
   cross join lateral jsonb_array_elements(pc.movements) pm
   cross join lateral jsonb_each(p.results) r
   where p.user_id=uid and p.class_id<>cid and p.status='completed' and p.finalized and p.difficulty=level
    and pc.status<>'cancelled' and pc.starts_at<c.starts_at and pc.starts_at>c.starts_at-interval '90 days'
    and r.key=pm->>'id' and pm->>'exercise_id'=m->>'exercise_id' and pm->>'kind'='weight'
    and pm->>'unit'=m->>'unit' and pm->>'load_basis'=m->>'load_basis' and pm->>'target_reps'=m->>'target_reps'
    and (r.value->>'reps')::numeric>=(m->>'target_reps')::numeric and (r.value->>'weight') is not null
    and coalesce(r.value->>'dnf','false')='false'
   order by pc.starts_at desc limit 1;
   if w is not null then source:='recent_result'; else
    select b.weight into w from public.group_baselines b where b.user_id=uid and b.exercise_id=m->>'exercise_id' and b.target_reps=(m->>'target_reps')::integer and b.unit=m->>'unit' and b.load_basis=m->>'load_basis' and b.difficulty=level;
    if w is not null then source:='coach_baseline'; end if;
   end if;
  else source:='program'; end if;
  answer:=answer||jsonb_build_object(m->>'id',jsonb_build_object('weight',w,'source',source,'source_id',source_id,'program_version',c.program_version,'rule_version','same-condition-v1','created_at',now()));
 end loop;
 return answer;
end $$;
revoke all on function private.group_recommend_legacy(uuid,uuid,text) from public,anon,authenticated;
create or replace function private.group_recommend(cid uuid, uid uuid, level text) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare c public.group_classes; m jsonb; s jsonb; answer jsonb:='{}'; legacy jsonb; recsets jsonb; w numeric; rm numeric; step numeric; effective numeric;
 source text; source_id text; past record; baseline public.group_strength_maxes; idx integer; basis text;
begin
 select * into c from public.group_classes where id=cid;
 legacy:=private.group_recommend_legacy(cid,uid,level);
 for m in select value from jsonb_array_elements(c.movements) loop
  if not (m ? 'training_type') then answer:=answer||jsonb_build_object(m->>'id',legacy->(m->>'id'));continue;end if;
  if m->>'training_type'<>'strength' then answer:=answer||jsonb_build_object(m->>'id',jsonb_build_object('weight',null,'source','program'));continue;end if;
  select * into baseline from public.group_strength_maxes b where b.user_id=uid and b.exercise_id=m->>'exercise_id' and b.unit=m->>'unit' and b.load_basis=m->>'load_basis'
   and b.measured_on<=least((c.starts_at at time zone 'Asia/Seoul')::date,(now() at time zone 'Asia/Seoul')::date)
   and b.measured_on>=least((c.starts_at at time zone 'Asia/Seoul')::date,(now() at time zone 'Asia/Seoul')::date)-180;
  step:=(m->>'load_step')::numeric;recsets:='[]';idx:=0;
  for s in select value from jsonb_array_elements(m->'sets') loop
   idx:=idx+1;w:=null;rm:=null;source:='coach_required';source_id:=null;basis:=null;effective:=(s->>'reps')::numeric+(s->>'rir')::numeric;
   -- Last completed, coach-confirmed matching set. Actual RIR is required to extrapolate.
   select p.id,p.session_rpe,rs.value as actual,ps.value as prescription,pc.starts_at into past
   from public.group_participants p join public.group_classes pc on pc.id=p.class_id
   cross join lateral jsonb_array_elements(pc.movements) pm
   cross join lateral jsonb_array_elements(case when jsonb_typeof(p.results->(pm->>'id')->'sets')='array' then p.results->(pm->>'id')->'sets' else '[]'::jsonb end) with ordinality rs(value,n)
   cross join lateral jsonb_array_elements(case when jsonb_typeof(pm->'sets')='array' then pm->'sets' else '[]'::jsonb end) with ordinality ps(value,n)
   where p.user_id=uid and p.status='completed' and p.finalized and p.difficulty=level and pc.id<>cid and pc.status<>'cancelled'
    and pc.starts_at<c.starts_at and pc.starts_at<now() and pc.starts_at>c.starts_at-interval '90 days'
    and pm->>'training_type'='strength' and pm->>'exercise_id'=m->>'exercise_id' and pm->>'unit'=m->>'unit' and pm->>'load_basis'=m->>'load_basis'
    and rs.n=ps.n and coalesce((rs.value->>'dnf')::boolean,false)=false and coalesce((p.results->(pm->>'id')->>'dnf')::boolean,false)=false
    and (rs.value->>'weight')::numeric>0 and (rs.value->>'reps')::numeric>0
    and (rs.value->>'reps')::numeric+coalesce((rs.value->>'rir')::numeric,0)<=15
   order by pc.starts_at desc,case when rs.n=idx then 0 else 1 end,rs.n desc limit 1;
   if effective<=15 then
    if past.id is not null and (past.actual->>'reps')::numeric=(s->>'reps')::numeric and (past.prescription->>'rir')::numeric=(s->>'rir')::numeric and (past.actual->>'rir') is null then
     w:=(past.actual->>'weight')::numeric;source:='recent_set';source_id:=past.id::text;
    elsif past.id is not null and past.actual->>'rir' is not null then
     rm:=(past.actual->>'weight')::numeric*(1+((past.actual->>'reps')::numeric+(past.actual->>'rir')::numeric)/30);
     w:=rm/(1+effective/30);source:='estimated_history';source_id:=past.id::text;
     -- A new program never increases a recent load by more than 5% automatically.
     w:=least(w,(past.actual->>'weight')::numeric*1.05);
    elsif baseline.weight is not null then
     rm:=baseline.weight;w:=rm/(1+effective/30);source:='one_rm';source_id:=baseline.measured_on::text;basis:=baseline.basis;
    else
     select b.weight into w from public.group_baselines b where b.user_id=uid and b.exercise_id=m->>'exercise_id' and b.target_reps=(s->>'reps')::integer and b.unit=m->>'unit' and b.load_basis=m->>'load_basis' and b.difficulty=level;
     if w is not null then source:='coach_baseline';end if;
    end if;
    if source in ('recent_set','estimated_history') and past.session_rpe>=9 then w:=w*0.95;end if;
    if w is not null then
     w:=floor(w/step)*step;
     if w<(m->>'min_load')::numeric or w<=0 or w>2000 then w:=null;source:='coach_required';end if;
    end if;
   end if;
   recsets:=recsets||jsonb_build_array(jsonb_build_object('reps',(s->>'reps')::integer,'rir',(s->>'rir')::numeric,'weight',w,'source',source,'source_id',source_id,'basis',basis,'estimated_1rm',round(rm,2),'high_effort_adjustment',coalesce(source in ('recent_set','estimated_history') and past.session_rpe>=9,false)));
  end loop;
  answer:=answer||jsonb_build_object(m->>'id',jsonb_build_object('weight',recsets->0->'weight','source',recsets->0->'source','sets',recsets,'program_version',c.program_version,'rule_version','strength-rir-v1','created_at',now()));
 end loop;
 return answer;
end $$;
create or replace function public.group_join(cid uuid, user_ids uuid[] default null, allow_exception boolean default false) returns jsonb language plpgsql security definer set search_path='' as $$
declare c public.group_classes; uid uuid; p public.group_participants; ids uuid[]; added integer:=0; existing integer:=0; eligible boolean; planned boolean; nextstate text;
begin
 allow_exception:=coalesce(allow_exception,false);
 if auth.uid() is null then raise exception '로그인이 필요해요.'; end if;
 select * into c from public.group_classes where id=cid for update;
 if not found or c.archived_at is not null then raise exception '참가할 수업을 확인해 주세요.'; end if;
 planned:=user_ids is not null and private.group_manage(cid) and c.status='published' and c.starts_at>now();
 if not planned and (c.status not in ('open','live') or (c.starts_at at time zone 'Asia/Seoul')::date<>(now() at time zone 'Asia/Seoul')::date) then raise exception '오늘 참가 접수가 열린 수업을 선택해 주세요.'; end if;
 nextstate:=case when planned then 'planned' else 'active' end;
 ids:=coalesce(user_ids,array[auth.uid()]);
 if cardinality(ids) not between 1 and 100 then raise exception '최대 100명까지 선택할 수 있어요.'; end if;
 if (user_ids is not null or allow_exception) and not private.group_manage(cid) then raise exception '담당 코치만 참가자를 추가할 수 있어요.'; end if;
 if allow_exception and not public.is_ntac_admin() then raise exception '일회 참가 예외는 관리자만 허용할 수 있어요.'; end if;
 foreach uid in array ids loop
  if uid is null then raise exception '회원을 선택해 주세요.'; end if;
  select * into p from public.group_participants where class_id=cid and user_id=uid;
  if found and (p.status in ('active','completed') or (planned and p.status='planned')) then existing:=existing+1;continue; end if;
  eligible:=exists(select 1 from public.group_members where user_id=uid and active);
  if not eligible and not allow_exception and not coalesce(p.status='planned' and p.exception_access,false) then raise exception '그룹 이용 권한이 없는 회원이 있어요. 관리자가 권한을 지정해 주세요.'; end if;
  insert into public.group_members(user_id,active) values(uid,false) on conflict(user_id) do nothing;
  insert into public.group_participants(class_id,user_id,recommendations,exception_access,status)
  values(cid,uid,private.group_recommend(cid,uid,coalesce(p.difficulty,'standard')),not eligible,nextstate)
  on conflict(class_id,user_id) do update set status=excluded.status,recommendations=case when group_participants.status='planned' then excluded.recommendations else group_participants.recommendations end,completed_at=null,exception_access=excluded.exception_access,revision=group_participants.revision+1,updated_at=now() returning * into p;
  insert into public.group_audit(class_id,participant_id,actor_id,action,detail) values(cid,p.id,auth.uid(),'join',jsonb_build_object('exception',not eligible));added:=added+1;
 end loop;
 return jsonb_build_object('added',added,'existing',existing);
end $$;
create or replace function public.group_save_participant(pid uuid, expected_revision integer, payload jsonb) returns void language plpgsql security definer set search_path='' as $$
declare p public.group_participants; c public.group_classes; manager boolean; newstate text; newlevel text; r jsonb; m jsonb; k text; v text; clean jsonb := '{}'; rec jsonb; reason text; ss jsonb; field text; si integer; newrpe numeric; weights jsonb;
begin
 select cl.* into c from public.group_classes cl join public.group_participants pp on pp.class_id=cl.id where pp.id=pid for update of cl;
 select * into p from public.group_participants where id=pid for update;
 if not found then raise exception '참가 정보를 찾을 수 없어요.'; end if;
 manager:=private.group_manage(p.class_id);
 if auth.uid() is null or (not manager and p.user_id<>auth.uid()) then raise exception '본인 또는 담당 코치만 기록을 저장할 수 있어요.'; end if;
 if p.revision is distinct from expected_revision then raise exception '다른 기기에서 기록이 바뀌었어요. 새로고침 후 다시 입력해 주세요.'; end if;
 if p.status='planned' then raise exception '먼저 오늘 운동 시작을 눌러 주세요.'; end if;
 if c.status in ('draft','published','cancelled') then raise exception '기록을 입력할 수 없는 수업이에요.'; end if;
 if not manager and (p.finalized or (c.status='ended' and now()>c.ended_at+interval '24 hours')) then raise exception '기록 수정 기간이 끝났어요. 코치에게 요청해 주세요.'; end if;
 newstate:=coalesce(payload->>'status',p.status);newlevel:=coalesce(payload->>'difficulty',p.difficulty);
 if newstate not in ('active','completed','left','cancelled') or newlevel not in ('foundation','standard','advanced') then raise exception '상태와 난이도를 확인해 주세요.'; end if;
 if p.status in ('left','cancelled') and newstate in ('active','completed') then raise exception '운동 시작으로 다시 참가한 뒤 기록해 주세요.'; end if;
 if newlevel<>p.difficulty and not manager then raise exception '난이도 변경은 코치에게 요청해 주세요.'; end if;
 if newstate='completed' and c.starts_at>now() then raise exception '수업 시작 이후 완료할 수 있어요.'; end if;
 if payload ? 'finalized' and not manager then raise exception '기록 확정은 코치만 가능해요.'; end if;
 newrpe:=case when payload ? 'session_rpe' then (payload->>'session_rpe')::numeric else p.session_rpe end;
 if newrpe is not null and (newrpe<0 or newrpe>10 or newrpe::text in ('NaN','Infinity','-Infinity')) then raise exception '수업 전체 RPE는 0~10으로 입력해 주세요.'; end if;
 if newstate='completed' and c.recording_version>=2 and newrpe is null then raise exception '마지막으로 수업 전체 RPE를 선택해 주세요.'; end if;
 r:=coalesce(payload->'results',p.results);
 if jsonb_typeof(r) is distinct from 'object' or pg_column_size(r)>30000 then raise exception '기록 형식을 확인해 주세요.'; end if;
 for k in select jsonb_object_keys(r) loop
  select value into m from jsonb_array_elements(c.movements) where value->>'id'=k;
  if m is null or jsonb_typeof(r->k)<>'object' then raise exception '프로그램에 있는 운동만 기록할 수 있어요.'; end if;
  for v in select jsonb_object_keys(r->k) loop
   if v='sets' then
    if m->>'training_type' is distinct from 'strength' or jsonb_typeof(r->k->v) is distinct from 'array' then raise exception '스트렝스 세트 기록 형식을 확인해 주세요.'; end if;
    if jsonb_array_length(r->k->v)<>jsonb_array_length(m->'sets') then raise exception '프로그램과 세트 수가 달라요.'; end if;
    for ss in select value from jsonb_array_elements(r->k->v) loop
     if jsonb_typeof(ss) is distinct from 'object' then raise exception '세트 기록 형식을 확인해 주세요.'; end if;
     for field in select jsonb_object_keys(ss) loop
      if field not in ('weight','reps','rir','dnf') then raise exception '허용되지 않은 세트 기록이에요.'; end if;
      if field='dnf' then
       if jsonb_typeof(ss->field) is distinct from 'boolean' then raise exception '미완주 여부를 확인해 주세요.'; end if;
      else
       if jsonb_typeof(ss->field) not in ('number','null') or (ss->>field)::numeric<0 or (ss->>field)::numeric>(case field when 'rir' then 10 when 'weight' then 2000 else 1000 end) then raise exception '세트별 중량·반복·RIR 범위를 확인해 주세요.'; end if;
       if field='reps' and (ss->>field)::numeric<>trunc((ss->>field)::numeric) then raise exception '반복 수는 정수로 입력해 주세요.'; end if;
      end if;
     end loop;
    end loop;
    continue;
   end if;
   if v not in ('weight','reps','seconds','rounds','distance','calories','dnf') then raise exception '허용되지 않은 기록 항목이에요.'; end if;
   if v<>'dnf' and jsonb_typeof(r->k->v) not in ('number','null') then raise exception '기록은 숫자로 입력해 주세요.'; end if;
   if v in ('reps','rounds') and r->k->>v is not null and (r->k->>v)::numeric<>trunc((r->k->>v)::numeric) then raise exception '반복 수와 라운드는 정수로 입력해 주세요.'; end if;
   if v='dnf' and jsonb_typeof(r->k->v)<>'boolean' then raise exception '완주 여부를 확인해 주세요.'; end if;
   if v<>'dnf' and r->k->>v is not null and ((r->k->>v)::numeric<0 or (r->k->>v)::numeric>1000000 or (r->k->>v)::text in ('NaN','Infinity','-Infinity')) then raise exception '기록은 0 이상의 유효한 숫자로 입력해 주세요.'; end if;
  end loop;
  if coalesce((r->k->>'dnf')::boolean,false) not in (true,false) then raise exception '완주 여부를 확인해 주세요.'; end if;
  clean:=clean||jsonb_build_object(k,r->k);
 end loop;
 rec:=p.recommendations;
 if newlevel<>p.difficulty then rec:=private.group_recommend(p.class_id,p.user_id,newlevel); end if;
 if payload ? 'recommendations' then
  if not manager then raise exception '추천 조정은 코치만 가능해요.'; end if;
  reason:=trim(coalesce(payload->>'reason',''));
  if length(reason) not between 1 and 300 then raise exception '추천 조정 이유를 입력해 주세요.'; end if;
  for k in select jsonb_object_keys(payload->'recommendations') loop
   select value into m from jsonb_array_elements(c.movements) where value->>'id'=k and value->>'kind'='weight';
   if m->>'training_type'='strength' then
    weights:=payload->'recommendations'->k;
    if jsonb_typeof(weights) is distinct from 'array' then raise exception '세트별 추천 중량을 입력해 주세요.'; end if;
    if jsonb_array_length(weights)<>jsonb_array_length(m->'sets') then raise exception '추천 세트 수를 확인해 주세요.'; end if;
    si:=0;r:='[]';
    for ss in select value from jsonb_array_elements(weights) loop
     if jsonb_typeof(ss) not in ('number','null') or (ss#>>'{}')::numeric not between 0 and 2000 then raise exception '추천 중량은 0~2000으로 입력해 주세요.'; end if;
     r:=r||jsonb_build_array((m->'sets'->si)||jsonb_build_object('weight',ss,'source','coach_override'));si:=si+1;
    end loop;
    rec:=rec||jsonb_build_object(k,jsonb_build_object('sets',r,'weight',r->0->'weight','source','coach_override','reason',reason,'rule_version','coach-v2','program_version',c.program_version));
    continue;
   end if;
   if m is null or coalesce((payload->'recommendations'->>k)::numeric,-1) not between 0 and 2000 then raise exception '조정할 운동과 중량을 확인해 주세요.'; end if;
   rec:=rec||jsonb_build_object(k,jsonb_build_object('weight',(payload->'recommendations'->>k)::numeric,'source','coach_override','reason',reason,'program_version',c.program_version,'rule_version','coach-v1','created_at',now()));
  end loop;
 end if;
 update public.group_participants set session_rpe=newrpe,results=clean,recommendations=rec,status=newstate,difficulty=newlevel,note=coalesce(payload->>'note',note),finalized=coalesce((payload->>'finalized')::boolean,finalized),completed_at=case when newstate='completed' then coalesce(completed_at,now()) else null end,revision=revision+1,updated_at=now() where id=pid;
 insert into public.group_audit(class_id,participant_id,actor_id,action,detail) values(p.class_id,pid,auth.uid(),'save_record',jsonb_build_object('before',to_jsonb(p),'changes',payload));
end $$;
create or replace function public.group_display(display_token text) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare t private.group_display_tokens; w public.group_walls; c public.group_classes;
begin
 if length(coalesce(display_token,''))<>72 then raise exception 'TV 연결 링크를 확인해 주세요.'; end if;
 select * into t from private.group_display_tokens where token_hash=encode(sha256(convert_to(display_token,'UTF8')),'hex') and not revoked and expires_at>now();
 if not found then raise exception 'TV 연결이 해제됐거나 만료됐어요. 관리자에게 새 링크를 요청해 주세요.'; end if;
 select * into w from public.group_walls where id=t.wall_id;
 select * into c from public.group_classes where id=w.class_id and status in ('open','live','ended') and archived_at is null;
 return jsonb_build_object('kind',t.kind,'wall',w.title,'updated_at',now(),'movement_id',w.movement_id,
 'class',case when c.id is null then null else jsonb_build_object('id',c.id,'title',c.title,'starts_at',c.starts_at,'status',c.status,'movements',c.movements,'program_version',c.program_version) end,
 'participants',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'name',g.nickname,'status',p.status,'difficulty',p.difficulty,'finalized',p.finalized,
 'recommendations',case when t.kind='recommendations' then (select jsonb_object_agg(k,jsonb_build_object('weight',v->'weight','source',v->'source','sets',(select jsonb_agg(jsonb_build_object('weight',ss->'weight','reps',ss->'reps','rir',ss->'rir','source',ss->'source')) from jsonb_array_elements(coalesce(v->'sets','[]')) ss))) from jsonb_each(p.recommendations) x(k,v)) else null end,
 'results',case when t.kind='results' then p.results else null end) order by p.joined_at)
 from public.group_participants p join public.group_members g on g.user_id=p.user_id where p.class_id=c.id and p.status in ('active','completed') and g.show_on_tv and length(trim(g.nickname))>0),'[]'));
end $$;
create function public.group_cancel_planned(pid uuid, expected_revision integer) returns void language plpgsql security definer set search_path='' as $$
declare p public.group_participants; c public.group_classes;
begin
 select cl.* into c from public.group_classes cl join public.group_participants pp on pp.class_id=cl.id where pp.id=pid for update of cl;
 select * into p from public.group_participants where id=pid for update;
 if auth.uid() is null or not private.group_manage(p.class_id) then raise exception '담당 코치만 사전 참가를 취소할 수 있어요.'; end if;
 if p.revision is distinct from expected_revision or p.status<>'planned' then raise exception '참가 상태가 변경됐어요. 다시 불러와 주세요.'; end if;
 update public.group_participants set status='cancelled',revision=revision+1,updated_at=now() where id=pid;
 insert into public.group_audit(class_id,participant_id,actor_id,action) values(p.class_id,pid,auth.uid(),'cancel_planned');
end $$;
revoke all on function public.group_save_timetable(jsonb,integer),public.group_save_week(jsonb),public.group_remove_program(text,uuid,integer),public.group_set_strength_max(jsonb),public.group_cancel_planned(uuid,integer) from public,anon,authenticated;
grant execute on function public.group_save_timetable(jsonb,integer),public.group_save_week(jsonb),public.group_remove_program(text,uuid,integer),public.group_set_strength_max(jsonb),public.group_cancel_planned(uuid,integer) to authenticated;
notify pgrst,'reload schema';
