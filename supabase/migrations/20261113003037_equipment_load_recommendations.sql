-- Per-bar feasible loading, not a reservation of the shared room inventory.
-- Microplate room inventory: 1 kg x4, 1.5 kg x6, 2.5 kg x6.
-- Larger plates are denominations only; their shared quantities are not known.
create function private.group_equipment_load(target numeric, bar numeric) returns jsonb
language plpgsql immutable security invoker set search_path='' as $$
declare a int; b int; c int; remaining numeric; total numeric; best numeric:=-1; count int; best_count int:=10000;
 n20 int; n15 int; n10 int; n5 int; plates jsonb; best_plates jsonb;
begin
 if target is null or target::text in ('NaN','Infinity','-Infinity') or target<bar or target>2000 or bar not in (7.5,15,20) then return jsonb_build_object('weight',null);end if;
 -- Counts are symmetric PAIRS; never exceed the known room stock on one bar.
 for a in 0..2 loop for b in 0..3 loop for c in 0..3 loop
  remaining:=target-bar-2*a-3*b-5*c;
  if remaining<0 then continue;end if;
  remaining:=floor(remaining/10)*5; -- per-side remainder, multiple of 5 kg
  total:=bar+2*a+3*b+5*c+2*remaining;
  n20:=floor(remaining/20);remaining:=remaining-20*n20;
  n15:=floor(remaining/15);remaining:=remaining-15*n15;
  n10:=floor(remaining/10);remaining:=remaining-10*n10;
  n5:=floor(remaining/5);count:=a+b+c+n20+n15+n10+n5;
  if total>best or (total=best and count<best_count) then
   plates:='[]';
   if n20>0 then plates:=plates||jsonb_build_array(jsonb_build_object('kg',20,'count',n20));end if;
   if n15>0 then plates:=plates||jsonb_build_array(jsonb_build_object('kg',15,'count',n15));end if;
   if n10>0 then plates:=plates||jsonb_build_array(jsonb_build_object('kg',10,'count',n10));end if;
   if n5>0 then plates:=plates||jsonb_build_array(jsonb_build_object('kg',5,'count',n5));end if;
   if c>0 then plates:=plates||jsonb_build_array(jsonb_build_object('kg',2.5,'count',c));end if;
   if b>0 then plates:=plates||jsonb_build_array(jsonb_build_object('kg',1.5,'count',b));end if;
   if a>0 then plates:=plates||jsonb_build_array(jsonb_build_object('kg',1,'count',a));end if;
   best:=total;best_count:=count;best_plates:=plates;
  end if;
 end loop;end loop;end loop;
 return jsonb_build_object('weight',best,'bar_weight',bar,'plates_per_side',best_plates,'equipment_scope','single_bar_not_reserved');
end $$;
revoke all on function private.group_equipment_load(numeric,numeric) from public,anon,authenticated;

-- Preserve data selection, 5% growth ceiling and permission boundaries, but
-- retain the unrounded target until the physical equipment pass below.
do $$ declare body text; anchor text;
begin
 select pg_get_functiondef('private.group_recommend_full_sets(uuid,uuid,text)'::regprocedure) into body;
 anchor:='w:=floor(w/step)*step;';
 if position(anchor in body)=0 then raise exception 'Full-set rounding anchor missing';end if;
 body:=replace(body,anchor,'if m->>''exercise_id'' not in (''back_squat'',''front_squat'',''bench_press'',''pendlay_row'',''deadlift'',''overhead_press'',''push_press'',''push_jerk'',''power_clean'') or m->>''unit''<>''kg'' or m->>''load_basis''<>''total'' then w:=floor(w/step)*step;end if;');
 execute body;
 select pg_get_functiondef('private.group_recommend(uuid,uuid,text)'::regprocedure) into body;
 anchor:='floor(least(rm/(1+effective/30),latest.weight*1.05)/coalesce(nullif((m->>''load_step'')::numeric,0),2.5))*coalesce(nullif((m->>''load_step'')::numeric,0),2.5)';
 if position(anchor in body)=0 then raise exception 'Last-set rounding anchor missing';end if;
 body:=replace(body,anchor,'least(rm/(1+effective/30),latest.weight*1.05)');
 execute body;
end $$;
alter function private.group_recommend(uuid,uuid,text) rename to group_recommend_before_equipment;
create function private.group_recommend(cid uuid,uid uuid,level text) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare answer jsonb; m jsonb; entry jsonb; s jsonb; adjusted jsonb; loading jsonb; low numeric; bar numeric; c public.group_classes;
begin
 answer:=private.group_recommend_before_equipment(cid,uid,level);
 select * into c from public.group_classes where id=cid;
 for m in select value from jsonb_array_elements(c.movements) loop
  if m->>'training_type' is distinct from 'strength' or m->>'unit' is distinct from 'kg' or m->>'load_basis' is distinct from 'total' or m->>'exercise_id' not in ('back_squat','front_squat','bench_press','pendlay_row','deadlift','overhead_press','push_press','push_jerk','power_clean') then continue;end if;
  entry:=answer->(m->>'id');
  select min((x->>'weight')::numeric) into low from jsonb_array_elements(coalesce(entry->'sets','[]')) x where (x->>'weight')::numeric>=7.5;
  if low is null then bar:=7.5;else bar:=case when low>=20 then 20 when low>=15 then 15 else 7.5 end;end if;
  adjusted:='[]';
  for s in select value from jsonb_array_elements(coalesce(entry->'sets','[]')) loop
   loading:=private.group_equipment_load((s->>'weight')::numeric,bar);
   if (loading->>'weight')::numeric<coalesce((m->>'min_load')::numeric,0) then loading:=jsonb_build_object('weight',null);end if;
   adjusted:=adjusted||jsonb_build_array(s||loading||jsonb_build_object('calculated_weight',s->'weight'));
  end loop;
  answer:=answer||jsonb_build_object(m->>'id',entry||jsonb_build_object('sets',adjusted,'weight',adjusted->0->'weight','rule_version','equipment-rpe-v1','bar_weight',bar));
 end loop;
 return answer;
end $$;
revoke all on function private.group_recommend(uuid,uuid,text),private.group_recommend_before_equipment(uuid,uuid,text) from public,anon,authenticated;
