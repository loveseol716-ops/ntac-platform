-- Seasonal design guardrails. Exceptions stay in the existing admin-only table.
alter table public.group_key_descriptions add column design_exception_reason text not null default '' check(length(design_exception_reason)<=2000);
alter table public.group_key_descriptions add column design_issues jsonb not null default '[]' check(jsonb_typeof(design_issues)='array');
insert into public.group_exercises(id,name) values('hang_power_clean','행 파워 클린') on conflict(id) do nothing;
-- Keep hang and floor power-clean histories separate; never infer one from the other.
do $$ declare cn text; body text; f text;
begin
 for cn in select conname from pg_constraint where conrelid='public.group_last_sets'::regclass and contype='c' and pg_get_constraintdef(oid) like '%exercise_id%' loop execute format('alter table public.group_last_sets drop constraint %I',cn);end loop;
 alter table public.group_last_sets add constraint group_last_sets_core_exercise_check check(exercise_id in ('back_squat','front_squat','bench_press','pendlay_row','deadlift','overhead_press','push_press','push_jerk','power_clean','hang_power_clean'));
 foreach f in array array['private.group_save_last_sets(uuid,integer,jsonb)','private.group_recommend_full_sets(uuid,uuid,text)','private.group_recommend(uuid,uuid,text)','private.group_validate_movements(jsonb)'] loop
  select pg_get_functiondef(f::regprocedure) into body;
  if position('''power_clean''' in body)=0 then raise exception 'Core exercise list missing in %',f;end if;
  body:=replace(body,'''power_clean''','''power_clean'',''hang_power_clean''');execute body;
 end loop;
end $$;
create function private.group_design_rule(day date,class_type text) returns jsonb
language plpgsql immutable security invoker set search_path='' as $$
declare book jsonb:='{"version":"2026-preseason-v1","start":"2026-11-23","end":"2027-01-03","weeks":[{"week":1,"reps":[8,10],"rpe":[6,7],"defaultReps":8,"defaultRpe":6,"defaultSets":3},{"week":2,"reps":[6,8],"rpe":[7,7],"defaultReps":6,"defaultRpe":7,"defaultSets":3},{"week":3,"reps":[4,6],"rpe":[7,8],"defaultReps":4,"defaultRpe":7,"defaultSets":3},{"week":4,"reps":[4,6],"rpe":[6,7],"defaultReps":4,"defaultRpe":6,"defaultSets":3,"maintainWeek":3},{"week":5,"reps":null,"rpe":[6,7],"defaultReps":4,"defaultRpe":6,"defaultSets":2,"note":"리프팅·메트콘 저볼륨 예열. 카디오 평가에 피로를 겹치지 않아요."},{"week":6,"reps":null,"rpe":null,"defaultReps":5,"defaultRpe":9,"defaultSets":1,"note":"Gentle Strength: 백스쿼트 5RM·행 파워클린 1RM. Bomb Strength: 메트콘 평가, 필수 리프트·일반 반복 기준 제외."}]}'; w int; r jsonb;
begin
 if day is null or day<(book->>'start')::date or day>(book->>'end')::date or class_type not in ('gentle_strength','bomb_strength') or class_type is null then return null;end if;
 w:=(day-(book->>'start')::date)/7+1;r:=book->'weeks'->(w-1);
 return r||jsonb_build_object('version',book->>'version','required',case when w=6 and class_type='bomb_strength' then '[]'::jsonb else '["back_squat","hang_power_clean"]'::jsonb end,'assessment',w=6 and class_type='gentle_strength');
end $$;
create function private.group_design_reference(day date,class_type text) returns jsonb
language plpgsql stable security invoker set search_path='' as $$
declare r jsonb; ms jsonb;
begin
 r:=private.group_design_rule(day,class_type);if r->>'maintainWeek' is null then return null;end if;
 select p->'movements' into ms from public.group_weeks w cross join lateral jsonb_array_elements(coalesce(w.programs,'[]')) p
 where w.week_start='2026-12-07' and w.status<>'archived' and p->>'class_type_id'=class_type and jsonb_array_length(coalesce(p->'movements','[]'))>0
 order by (w.status='published') desc,w.updated_at desc limit 1;
 if ms is null then
  select c.movements into ms from public.group_classes c where (c.starts_at at time zone 'Asia/Seoul')::date between '2026-12-07' and '2026-12-13' and c.archived_at is null and c.status<>'cancelled'
  and (c.class_type_id=class_type or (c.class_type_id is null and upper(c.title)=replace(upper(class_type),'_',' '))) and jsonb_array_length(c.movements)>0 order by c.starts_at desc limit 1;
 end if;return ms;
end $$;
create function private.group_design_reference_checked(day date,class_type text) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin if auth.uid() is null or not private.group_staff() then raise exception '코치 권한이 필요해요.';end if;return private.group_design_reference(day,class_type);end $$;
create function public.group_design_reference(day date,class_type text) returns jsonb
language sql stable security invoker set search_path='' as $$ select private.group_design_reference_checked(day,class_type); $$;

create function private.group_design_issues(day date,class_type text,ms jsonb) returns jsonb
language plpgsql stable security invoker set search_path='' as $$
declare r jsonb:=private.group_design_rule(day,class_type); issues jsonb:='[]'; m jsonb; s jsonb; id text; lo numeric; hi numeric; v numeric; rpelo numeric; rpehi numeric; ref jsonb; previous jsonb;
begin
 if r is null then return issues;end if;
 for id in select jsonb_array_elements_text(r->'required') loop
  if not exists(select 1 from jsonb_array_elements(ms) x where x->>'exercise_id'=id and x->>'training_type'='strength') then issues:=issues||jsonb_build_array(case id when 'back_squat' then '백 스쿼트 누락' else '행 파워 클린 누락' end);end if;
 end loop;
 if (r->>'week')::int=6 and not (r->>'assessment')::boolean then return issues;end if;
 ref:=private.group_design_reference(day,class_type);
 for m in select value from jsonb_array_elements(ms) where value->>'training_type'='strength' loop
  lo:=null;hi:=null;
  if (r->>'assessment')::boolean then
   if m->>'exercise_id'='back_squat' then lo:=5;hi:=5;elsif m->>'exercise_id'='hang_power_clean' then lo:=1;hi:=1;end if;
  elsif m->>'exercise_id' in ('hang_power_clean','power_clean','push_jerk') then lo:=null;hi:=null;
  elsif jsonb_typeof(r->'reps')='array' then lo:=(r->'reps'->>0)::numeric;hi:=(r->'reps'->>1)::numeric;end if;
  if lo is not null and exists(select 1 from jsonb_array_elements(m->'sets') x where (x->>'reps')::numeric not between lo and hi) then issues:=issues||jsonb_build_array(coalesce(m->>'label',m->>'exercise_id')||': 반복 수 기준 이탈');end if;
  if jsonb_typeof(r->'rpe')='array' and m->>'exercise_id' not in ('hang_power_clean','power_clean','push_jerk') then
   rpelo:=(r->'rpe'->>0)::numeric;rpehi:=(r->'rpe'->>1)::numeric;
   for s in select value from jsonb_array_elements(m->'sets') loop
    if m->>'prescription_mode'='percent_1rm' then lo:=floor(100/(1+((s->>'reps')::numeric+10-rpelo)/30));hi:=ceil(100/(1+((s->>'reps')::numeric+10-rpehi)/30));v:=(s->>'percent_1rm')::numeric;
    else lo:=rpelo;hi:=rpehi;v:=10-(s->>'rir')::numeric;end if;
    if v is null or v not between lo and hi then issues:=issues||jsonb_build_array(coalesce(m->>'label',m->>'exercise_id')||': 주차별 강도 기준 이탈');exit;end if;
   end loop;
  end if;
  if r ? 'maintainWeek' then
   select x into previous from jsonb_array_elements(coalesce(ref,'[]')) x where x->>'exercise_id'=m->>'exercise_id' limit 1;
   if previous is null then issues:=issues||jsonb_build_array(coalesce(m->>'label',m->>'exercise_id')||': 3주차 비교 기준 없음');
   else
    if (select jsonb_agg(x->'reps') from jsonb_array_elements(previous->'sets') x) is distinct from (select jsonb_agg(x->'reps') from jsonb_array_elements(m->'sets') x) then issues:=issues||jsonb_build_array(coalesce(m->>'label',m->>'exercise_id')||': 3주차 세트·반복 수 변경');end if;
    if exists(select 1 from jsonb_array_elements(m->'sets') with ordinality cur(s,n) join jsonb_array_elements(previous->'sets') with ordinality prev(s,n) using(n)
     where (case when m->>'prescription_mode'='percent_1rm' then (cur.s->>'percent_1rm')::numeric else 100/(1+((cur.s->>'reps')::numeric+(cur.s->>'rir')::numeric)/30) end)
      >=(case when previous->>'prescription_mode'='percent_1rm' then (prev.s->>'percent_1rm')::numeric else 100/(1+((prev.s->>'reps')::numeric+(prev.s->>'rir')::numeric)/30) end)) then issues:=issues||jsonb_build_array(coalesce(m->>'label',m->>'exercise_id')||': 3주차보다 강도를 낮춰 주세요');end if;
   end if;
  end if;
 end loop;return issues;
end $$;

create function private.group_check_design(day date,class_type text,p jsonb,kind text,target uuid,pkey text) returns void
language plpgsql security invoker set search_path='' as $$
declare issues jsonb; reason text; r jsonb:=private.group_design_rule(day,class_type);
begin
 if r is null then return;end if;
 if jsonb_array_length(coalesce(p->'movements','[]'))=0 and length(trim(coalesce(p->>'description','')))=0 then return;end if;
 if p ? 'design_exception_reason' and jsonb_typeof(p->'design_exception_reason') not in ('string','null') then raise exception '설계 예외 사유는 글로 입력해 주세요.';end if;
 issues:=private.group_design_issues(day,class_type,coalesce(p->'movements','[]'));reason:=trim(coalesce(p->>'design_exception_reason',''));
 if length(reason)>2000 or (jsonb_array_length(issues)>0 and length(reason)<20) then raise exception '% %주차: % — 변경 사유와 대체·보완 계획을 20자 이상 적어 주세요.',class_type,r->>'week',issues;end if;
 if kind='class' then
  insert into public.group_key_descriptions(class_id,key_description,design_exception_reason,design_issues,updated_by) values(target,'',reason,issues,auth.uid())
  on conflict(class_id) where class_id is not null do update set design_exception_reason=excluded.design_exception_reason,design_issues=excluded.design_issues,updated_by=excluded.updated_by,updated_at=now();
 elsif kind='week' then
  insert into public.group_key_descriptions(week_id,program_key,key_description,design_exception_reason,design_issues,updated_by) values(target,pkey,'',reason,issues,auth.uid())
  on conflict(week_id,program_key) where week_id is not null do update set design_exception_reason=excluded.design_exception_reason,design_issues=excluded.design_issues,updated_by=excluded.updated_by,updated_at=now();
 end if;
 insert into public.group_audit(class_id,actor_id,action,detail) values(case when kind='class' then target end,auth.uid(),'design_check',jsonb_build_object('kind',kind,'target',target,'program_key',pkey,'version',r->>'version','week',r->'week','issues',issues,'exception_recorded',length(reason)>0));
end $$;
alter function private.group_save_class_with_keys(jsonb) rename to group_save_class_before_design;
alter function private.group_save_week_with_keys(jsonb) rename to group_save_week_before_design;
revoke all on function private.group_save_class_before_design(jsonb),private.group_save_week_before_design(jsonb) from public,anon,authenticated;
create function private.group_save_class_with_keys(payload jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare cid uuid; c public.group_classes;
begin
 cid:=private.group_save_class_before_design(payload-'design_exception_reason'-'design_issues');select * into c from public.group_classes where id=cid;
 perform private.group_check_design((c.starts_at at time zone 'Asia/Seoul')::date,coalesce(c.class_type_id,case upper(c.title) when 'GENTLE STRENGTH' then 'gentle_strength' when 'BOMB STRENGTH' then 'bomb_strength' end),payload,'class',cid,'');return cid;
end $$;
create function private.group_save_week_with_keys(payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare clean jsonb:=payload-'design_exception_reason'-'design_issues'; field text; r jsonb; item jsonb; items jsonb; d date; t text;
begin
 foreach field in array array['programs','days'] loop if payload ? field then select jsonb_agg(x-'design_exception_reason'-'design_issues') into items from jsonb_array_elements(payload->field) x;clean:=jsonb_set(clean,array[field],coalesce(items,'[]'));end if;end loop;
 r:=private.group_save_week_before_design(clean);field:=case when payload->>'program_mode'='class_type' then 'programs' else 'days' end;
 for item in select value from jsonb_array_elements(payload->field) loop
  d:=(payload->>'week_start')::date+case when field='days' then (item->>'dow')::int-1 else 0 end;
  t:=coalesce(item->>'class_type_id',case upper(item->>'title') when 'GENTLE STRENGTH' then 'gentle_strength' when 'BOMB STRENGTH' then 'bomb_strength' end);
  perform private.group_check_design(d,t,item,'week',(r->>'id')::uuid,coalesce(item->>'class_type_id',item->>'dow'));
 end loop;return r;
end $$;
-- Publishing a saved legacy draft also runs the current seasonal checks.
alter function public.group_set_class_status(uuid,text,integer) set schema private;
alter function private.group_set_class_status(uuid,text,integer) rename to group_set_class_status_before_design;
revoke all on function private.group_set_class_status_before_design(uuid,text,integer) from public,anon,authenticated;
create function private.group_set_class_status_design(cid uuid,next_status text,expected_revision integer) returns void
language plpgsql security definer set search_path='' as $$
declare c public.group_classes; note text; pkey text;
begin
 perform private.group_set_class_status_before_design(cid,next_status,expected_revision);
 if next_status in ('published','open','live') then
  select * into c from public.group_classes where id=cid;
  select design_exception_reason into note from public.group_key_descriptions where class_id=cid;
  if not found and c.week_id is not null then select k.design_exception_reason into note from public.group_key_descriptions k where k.week_id=c.week_id and k.program_key=c.class_type_id;end if;
  perform private.group_check_design((c.starts_at at time zone 'Asia/Seoul')::date,coalesce(c.class_type_id,case upper(c.title) when 'GENTLE STRENGTH' then 'gentle_strength' when 'BOMB STRENGTH' then 'bomb_strength' end),to_jsonb(c)||jsonb_build_object('design_exception_reason',coalesce(note,'')),'class',cid,'');
 end if;
end $$;
create function public.group_set_class_status(cid uuid,next_status text,expected_revision integer) returns void
language sql security invoker set search_path='' as $$ select private.group_set_class_status_design(cid,next_status,expected_revision); $$;

-- Admin hydration reuses the same protected notes table. Members get neither reason nor issues.
do $$ declare body text; anchor text;
begin
 select pg_get_functiondef('private.group_detail_with_keys(uuid)'::regprocedure) into body;
 body:=replace(body,'note text;','note text; design_note text; design_flags jsonb;');
 anchor:='r:=jsonb_set(r,''{class}'',(r->''class'')||jsonb_build_object(''key_description'',coalesce(note,'''')));';
 if position(anchor in body)=0 then raise exception 'Admin note hydration anchor missing';end if;
 body:=replace(body,anchor,anchor||$patch$
  select k.design_exception_reason,k.design_issues into design_note,design_flags from public.group_key_descriptions k where k.class_id=cid;
  if not found and c.week_id is not null then select k.design_exception_reason,k.design_issues into design_note,design_flags from public.group_key_descriptions k join public.group_weeks w on w.id=k.week_id where k.week_id=c.week_id and k.program_key=case when w.program_mode='class_type' then c.class_type_id else extract(isodow from c.starts_at at time zone 'Asia/Seoul')::integer::text end;end if;
  r:=jsonb_set(r,'{class}',(r->'class')||jsonb_build_object('design_exception_reason',coalesce(design_note,''),'design_issues',coalesce(design_flags,'[]')));
$patch$);execute body;
end $$;
revoke all on function private.group_design_rule(date,text),private.group_design_reference(date,text),private.group_design_issues(date,text,jsonb),private.group_check_design(date,text,jsonb,text,uuid,text),private.group_design_reference_checked(date,text),public.group_design_reference(date,text),private.group_save_class_with_keys(jsonb),private.group_save_week_with_keys(jsonb),private.group_set_class_status_design(uuid,text,integer),public.group_set_class_status(uuid,text,integer) from public,anon,authenticated;
grant execute on function private.group_design_reference_checked(date,text),public.group_design_reference(date,text),private.group_save_class_with_keys(jsonb),private.group_save_week_with_keys(jsonb),private.group_set_class_status_design(uuid,text,integer),public.group_set_class_status(uuid,text,integer) to authenticated;
notify pgrst,'reload schema';
