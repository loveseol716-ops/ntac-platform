-- Optional %1RM prescriptions. Actual effort remains an independent RPE record.
alter function private.group_validate_movements(jsonb) rename to group_validate_movements_before_percentage;
create function private.group_validate_movements(items jsonb) returns void
language plpgsql security invoker set search_path='' as $$
declare m jsonb; s jsonb; normalized jsonb:='[]'; sets jsonb;
begin
 if items is null or jsonb_typeof(items)<>'array' then raise exception '핵심 운동 형식을 확인해 주세요.';end if;
 for m in select value from jsonb_array_elements(items) loop
  if m ? 'prescription_mode' and (jsonb_typeof(m->'prescription_mode') is distinct from 'string' or m->>'prescription_mode' not in ('rpe','percent_1rm')) then raise exception '추천 중량 기준을 확인해 주세요.';end if;
  if m->>'prescription_mode'='percent_1rm' then
   if m->>'training_type' is distinct from 'strength' or m->>'unit' is distinct from 'kg' or m->>'load_basis' is distinct from 'total' or m->>'exercise_id' not in ('back_squat','front_squat','bench_press','pendlay_row','deadlift','overhead_press','push_press','push_jerk','power_clean') or jsonb_typeof(m->'sets') is distinct from 'array' then raise exception '%%1RM은 핵심 스트렝스 운동에서만 사용해 주세요.';end if;
   sets:='[]';
   for s in select value from jsonb_array_elements(m->'sets') loop
    if jsonb_typeof(s->'percent_1rm') is distinct from 'number' or (s->>'percent_1rm')::numeric not between 1 and 100 then raise exception '%%1RM은 1~100 사이 숫자로 입력해 주세요.';end if;
    -- Compatibility validation only; never persist or display a fabricated RPE.
    sets:=sets||jsonb_build_array(s||jsonb_build_object('rir',0));
   end loop;
   m:=m||jsonb_build_object('sets',sets);
  end if;
  normalized:=normalized||jsonb_build_array(m);
 end loop;
 perform private.group_validate_movements_before_percentage(normalized);
end $$;
revoke all on function private.group_validate_movements(jsonb),private.group_validate_movements_before_percentage(jsonb) from public,anon,authenticated;

do $$ declare body text; anchor text;
begin
 select pg_get_functiondef('private.group_recommend_full_sets(uuid,uuid,text)'::regprocedure) into body;
 anchor:='effective:=(s->>''reps'')::numeric+(s->>''rir'')::numeric;';
 if position(anchor in body)=0 then raise exception 'Full-set intensity anchor missing';end if;
 body:=replace(body,anchor,'effective:=case when m->>''prescription_mode''=''percent_1rm'' then 0 else (s->>''reps'')::numeric+(s->>''rir'')::numeric end;');
 anchor:='    if w is not null then';
 if position(anchor in body)=0 then raise exception 'Full-set weight guard missing';end if;
 body:=replace(body,anchor,$patch$
    if m->>'prescription_mode'='percent_1rm' then
     if rm is null and baseline.weight is not null then rm:=baseline.weight;source:='one_rm';source_id:=baseline.measured_on::text;basis:=baseline.basis;end if;
     w:=rm*(s->>'percent_1rm')::numeric/100;
     if rm is null then source:='coach_required';end if;
     if source='estimated_history' then w:=least(w,(past.actual->>'weight')::numeric*1.05);end if;
    end if;
    if w is not null then$patch$);
 anchor:='''rir'',(s->>''rir'')::numeric,''weight'',w';
 if position(anchor in body)=0 then raise exception 'Full-set projection anchor missing';end if;
 body:=replace(body,anchor,'''rir'',(s->>''rir'')::numeric,''percent_1rm'',s->''percent_1rm'',''weight'',w');
 execute body;

 select pg_get_functiondef('private.group_recommend_before_equipment(uuid,uuid,text)'::regprocedure) into body;
 anchor:='effective:=(s->>''reps'')::numeric+(s->>''rir'')::numeric;';
 if position(anchor in body)=0 then raise exception 'Last-set intensity anchor missing';end if;
 body:=replace(body,anchor,'effective:=case when m->>''prescription_mode''=''percent_1rm'' then 0 else (s->>''reps'')::numeric+(s->>''rir'')::numeric end;');
 anchor:='w:=least(rm/(1+effective/30),latest.weight*1.05);';
 if position(anchor in body)=0 then raise exception 'Last-set target anchor missing';end if;
 body:=replace(body,anchor,'w:=least(case when m->>''prescription_mode''=''percent_1rm'' then rm*(s->>''percent_1rm'')::numeric/100 else rm/(1+effective/30) end,latest.weight*1.05);');
 execute body;
end $$;
