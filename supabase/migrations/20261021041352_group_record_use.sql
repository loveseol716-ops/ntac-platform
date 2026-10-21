-- Explicit per-movement record use. Missing metadata means log_only, including
-- historical classes and cached clients. No stored result, max or snapshot is rewritten.
-- Receiving a recommendation is independent of contributing records to estimates.
create or replace function private.group_validate_movements(items jsonb) returns void language plpgsql security invoker set search_path='' as $$
declare m jsonb; s jsonb; ids text[] := '{}';
begin
 if items is null or jsonb_typeof(items)<>'array' or jsonb_array_length(items)>20 then raise exception '핵심 운동은 최대 20개까지 등록할 수 있어요.'; end if;
 for m in select value from jsonb_array_elements(items) loop
  if length(coalesce(m->>'id','')) not between 1 and 80 or m->>'id' in ('__proto__','constructor','prototype') or m->>'id'=any(ids) or not exists(select 1 from public.group_exercises where id=m->>'exercise_id') then raise exception '운동 ID와 표준 종목을 확인해 주세요.'; end if;
  if m ? 'training_type' and coalesce(m->>'training_type','') not in ('strength','conditioning','other') then raise exception '운동 구분을 확인해 주세요.'; end if;
  if m ? 'record_use' and (jsonb_typeof(m->'record_use') is distinct from 'string' or m->>'record_use' not in ('log_only','strength_estimate')) then raise exception '기록 활용 구분을 확인해 주세요.'; end if;
  if m->>'record_use'='strength_estimate' and m->>'training_type' is distinct from 'strength' then raise exception '근력 추정용은 세트별 스트렝스 기록에서만 선택할 수 있어요.'; end if;
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
    and pm->>'record_use'='strength_estimate'
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
  answer:=answer||jsonb_build_object(m->>'id',jsonb_build_object('weight',w,'source',source,'source_id',source_id,'program_version',c.program_version,'rule_version','same-condition-v2-record-use','created_at',now()));
 end loop;
 return answer;
end $$;

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
   select p.id,rs.value as actual,ps.value as prescription,pc.starts_at into past
   from public.group_participants p join public.group_classes pc on pc.id=p.class_id
   cross join lateral jsonb_array_elements(pc.movements) pm
   cross join lateral jsonb_array_elements(case when jsonb_typeof(p.results->(pm->>'id')->'sets')='array' then p.results->(pm->>'id')->'sets' else '[]'::jsonb end) with ordinality rs(value,n)
   cross join lateral jsonb_array_elements(case when jsonb_typeof(pm->'sets')='array' then pm->'sets' else '[]'::jsonb end) with ordinality ps(value,n)
   where p.user_id=uid and p.status='completed' and p.finalized and p.difficulty=level and pc.id<>cid and pc.status<>'cancelled'
    and pc.starts_at<c.starts_at and pc.starts_at<now() and pc.starts_at>c.starts_at-interval '90 days'
    and pm->>'training_type'='strength' and pm->>'record_use'='strength_estimate' and pm->>'exercise_id'=m->>'exercise_id' and pm->>'unit'=m->>'unit' and pm->>'load_basis'=m->>'load_basis'
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
    if w is not null then
     w:=floor(w/step)*step;
     if w<(m->>'min_load')::numeric or w<=0 or w>2000 then w:=null;source:='coach_required';end if;
    end if;
   end if;
   recsets:=recsets||jsonb_build_array(jsonb_build_object('reps',(s->>'reps')::integer,'rir',(s->>'rir')::numeric,'weight',w,'source',source,'source_id',source_id,'basis',basis,'estimated_1rm',round(rm,2),'high_effort_adjustment',false));
  end loop;
  answer:=answer||jsonb_build_object(m->>'id',jsonb_build_object('weight',recsets->0->'weight','source',recsets->0->'source','sets',recsets,'program_version',c.program_version,'rule_version','strength-rir-v2-record-use','created_at',now()));
 end loop;
 return answer;
end $$;

create or replace function private.group_my_history() returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception '로그인이 필요해요.'; end if;
 return coalesce((select jsonb_agg(item order by joined_at desc, id) from (
   select p.id,p.joined_at,jsonb_build_object(
     'id',p.id,'class_id',p.class_id,'user_id',p.user_id,'status',p.status,
     'difficulty',p.difficulty,'results',p.results,'note',p.note,
     'session_rpe',p.session_rpe,'finalized',p.finalized,'joined_at',p.joined_at,
     'group_classes',jsonb_build_object(
       'id',c.id,'title',c.title,'starts_at',c.starts_at,'duration_minutes',c.duration_minutes,
       'status',c.status,'program_hidden',not private.group_access(c.id),
       'movements',coalesce((select jsonb_agg(jsonb_build_object(
         'id',m->>'id','label',coalesce(nullif(m->>'label',''),e.name,m->>'exercise_id'),
         'exercise_id',m->>'exercise_id','kind',m->>'kind','unit',m->>'unit',
         'training_type',m->>'training_type',
         'record_use',case when m->>'training_type'='strength' and m->>'record_use'='strength_estimate' then 'strength_estimate' else 'log_only' end
       ) order by ord) from jsonb_array_elements(c.movements) with ordinality as moves(m,ord)
         left join public.group_exercises e on e.id=m->>'exercise_id'
         where p.results ? (m->>'id')
       ),'[]'::jsonb)
     )
   ) as item
   from public.group_participants p join public.group_classes c on c.id=p.class_id
   where p.user_id=auth.uid()
   order by p.joined_at desc,p.id limit 200
 ) h),'[]'::jsonb);
end $$;

-- Retain the existing private-only recommendation boundary and self-scoped history.
revoke all on function private.group_validate_movements(jsonb), private.group_recommend_legacy(uuid,uuid,text), private.group_recommend(uuid,uuid,text) from public,anon,authenticated;
revoke all on function private.group_my_history() from public,anon,authenticated;
grant execute on function private.group_my_history() to authenticated;
