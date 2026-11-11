-- Preserve newer qualified full-set evidence when a prior last-set summary exists.
create or replace function private.group_recommend(cid uuid,uid uuid,level text) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare answer jsonb; c public.group_classes; m jsonb; s jsonb; latest record; recsets jsonb; w numeric; effective numeric; rm numeric; old_time timestamptz;
begin
 answer:=private.group_recommend_full_sets(cid,uid,level);
 select * into c from public.group_classes where id=cid;
 for m in select value from jsonb_array_elements(c.movements) loop
  if m->>'training_type' is distinct from 'strength' or m->>'unit' is distinct from 'kg' or m->>'load_basis' is distinct from 'total' then continue; end if;
  select l.*,pc.starts_at into latest from public.group_last_sets l join public.group_classes pc on pc.id=l.class_id join public.group_participants p on p.id=l.participant_id
   where l.user_id=uid and l.exercise_id=m->>'exercise_id' and l.class_id<>cid and p.status='completed' and pc.status<>'cancelled'
    and pc.starts_at<c.starts_at and pc.starts_at<now() and pc.starts_at>c.starts_at-interval '90 days'
    and l.reps+10-l.rpe<=15
   order by pc.starts_at desc,l.updated_at desc limit 1;
  if latest.participant_id is null then continue; end if;
  select pc.starts_at into old_time from public.group_participants p join public.group_classes pc on pc.id=p.class_id
   where p.id::text=coalesce(answer->(m->>'id')->>'source_id',answer->(m->>'id')->'sets'->0->>'source_id');
  if old_time>latest.starts_at then continue; end if;
  recsets:='[]';rm:=latest.weight*(1+(latest.reps+10-latest.rpe)/30);
  for s in select value from jsonb_array_elements(m->'sets') loop
   effective:=(s->>'reps')::numeric+(s->>'rir')::numeric;w:=null;
   if effective<=15 then
    w:=floor(least(rm/(1+effective/30),latest.weight*1.05)/coalesce(nullif((m->>'load_step')::numeric,0),2.5))*coalesce(nullif((m->>'load_step')::numeric,0),2.5);
    if w<=0 or w<coalesce((m->>'min_load')::numeric,0) then w:=null;end if;
   end if;
   recsets:=recsets||jsonb_build_array(s||jsonb_build_object('weight',w,'source',case when w is null then 'coach_required' else 'recent_last_set' end,'source_id',latest.participant_id,'estimated_1rm',round(rm,2)));
  end loop;
  answer:=answer||jsonb_build_object(m->>'id',jsonb_build_object('weight',recsets->0->'weight','source',recsets->0->'source','sets',recsets,'source_id',latest.participant_id,'rule_version','last-set-rpe-v1','program_version',c.program_version,'created_at',now()));
 end loop;
 return answer;
end $$;
revoke all on function private.group_recommend(uuid,uuid,text) from public,anon,authenticated;
