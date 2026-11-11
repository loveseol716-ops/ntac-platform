-- One real completed set per core lift, without inventing the other sets.
create table public.group_last_sets (
 participant_id uuid not null references public.group_participants(id) on delete cascade,
 movement_id text not null,
 class_id uuid not null references public.group_classes(id) on delete cascade,
 user_id uuid not null references public.profiles(id),
 exercise_id text not null references public.group_exercises(id),
 set_index integer not null check(set_index between 1 and 12),
 weight numeric not null check(weight>0 and weight<=2000),
 reps integer not null check(reps between 1 and 30),
 rpe numeric not null check(rpe between 1 and 10),
 updated_at timestamptz not null default now(),
 primary key(participant_id,movement_id),
 check(exercise_id in ('back_squat','front_squat','bench_press','pendlay_row','deadlift','overhead_press','push_press','push_jerk','power_clean'))
);
create index group_last_sets_recent on public.group_last_sets(user_id,exercise_id,updated_at desc);
create index group_last_sets_class on public.group_last_sets(class_id);
alter table public.group_last_sets enable row level security;
create policy last_sets_read on public.group_last_sets for select to authenticated
 using ((user_id=(select auth.uid()) and private.group_access(class_id)) or private.group_manage(class_id));
revoke all on public.group_last_sets from public,anon,authenticated;
grant select on public.group_last_sets to authenticated;

create function private.group_save_last_sets(pid uuid, expected_revision integer, entries jsonb) returns void
language plpgsql security definer set search_path='' as $$
declare p public.group_participants; c public.group_classes; manager boolean; phase text;
 entry jsonb; m jsonb; seen text[]:='{}'; mid text; idx integer; w numeric; reps integer; rpe numeric; saved jsonb; actual jsonb;
begin
 if auth.uid() is null then raise exception '로그인이 필요해요.'; end if;
 select cl.* into c from public.group_classes cl join public.group_participants pp on pp.class_id=cl.id where pp.id=pid for update of cl;
 select * into p from public.group_participants where id=pid for update;
 if not found then raise exception '참가 정보를 찾을 수 없어요.'; end if;
 manager:=private.group_manage(p.class_id);
 if not manager and (p.user_id<>auth.uid() or not private.group_access(p.class_id) or (not coalesce(p.exception_access,false) and not exists(select 1 from public.group_members gm where gm.user_id=auth.uid() and gm.active))) then raise exception '본인 또는 담당 코치만 기록할 수 있어요.'; end if;
 if p.revision is distinct from expected_revision then raise exception '다른 기기에서 기록이 바뀌었어요. 새로고침 후 다시 입력해 주세요.'; end if;
 phase:=private.group_class_phase(c.status,c.starts_at,c.duration_minutes);
 if c.archived_at is not null or phase not in ('live','ended') or p.status not in ('active','completed') then raise exception '참여한 수업에서 운동 후 기록해 주세요.'; end if;
 if not manager and (p.finalized or now()>coalesce(c.ended_at,c.starts_at+make_interval(mins=>c.duration_minutes))+interval '24 hours') then raise exception '기록 수정 기간이 끝났어요. 코치에게 요청해 주세요.'; end if;
 if jsonb_typeof(entries) is distinct from 'array' or jsonb_array_length(entries) not between 1 and 9 then raise exception '기록할 운동을 확인해 주세요.'; end if;
 saved:=p.results;
 for entry in select value from jsonb_array_elements(entries) loop
  mid:=entry->>'movement_id';
  if mid is null or mid=any(seen) then raise exception '운동별 한 번만 입력해 주세요.'; end if;
  seen:=array_append(seen,mid);
  select value into m from jsonb_array_elements(c.movements) where value->>'id'=mid;
  if m is null or m->>'training_type' is distinct from 'strength' or m->>'unit' is distinct from 'kg' or m->>'load_basis' is distinct from 'total'
   or m->>'exercise_id' not in ('back_squat','front_squat','bench_press','pendlay_row','deadlift','overhead_press','push_press','push_jerk','power_clean') then raise exception 'kg·바벨 포함 기준의 핵심 운동만 기록할 수 있어요.'; end if;
  if jsonb_typeof(entry->'set_index') is distinct from 'number' or jsonb_typeof(entry->'weight') is distinct from 'number' or jsonb_typeof(entry->'reps') is distinct from 'number' or jsonb_typeof(entry->'rpe') is distinct from 'number' then raise exception '중량·반복 수·RPE를 입력해 주세요.'; end if;
  if (entry->>'set_index')::numeric<>trunc((entry->>'set_index')::numeric) or (entry->>'reps')::numeric<>trunc((entry->>'reps')::numeric) then raise exception '세트와 반복 수는 정수로 입력해 주세요.'; end if;
  idx:=(entry->>'set_index')::integer;w:=(entry->>'weight')::numeric;reps:=(entry->>'reps')::integer;rpe:=(entry->>'rpe')::numeric;
  if idx not between 1 and jsonb_array_length(m->'sets') or w not between 0.01 and 2000 or reps not between 1 and 30 or rpe not between 1 and 10 or w::text in ('NaN','Infinity','-Infinity') or rpe::text in ('NaN','Infinity','-Infinity') then raise exception '중량·반복 수·RPE 범위를 확인해 주세요.'; end if;
  insert into public.group_last_sets(participant_id,movement_id,class_id,user_id,exercise_id,set_index,weight,reps,rpe)
   values(pid,mid,c.id,p.user_id,m->>'exercise_id',idx,w,reps,rpe)
   on conflict(participant_id,movement_id) do update set set_index=excluded.set_index,weight=excluded.weight,reps=excluded.reps,rpe=excluded.rpe,updated_at=now();
  actual:=jsonb_build_object('weight',w,'reps',reps,'rir',10-rpe);
  saved:=saved||jsonb_build_object(mid,jsonb_build_object('sets',(select jsonb_agg(case when n=idx then actual else coalesce(p.results->mid->'sets'->(n-1),'{}'::jsonb) end order by n) from generate_series(1,jsonb_array_length(m->'sets')) n)));
 end loop;
 update public.group_participants set results=saved,status='completed',completed_at=coalesce(completed_at,now()),revision=revision+1,updated_at=now() where id=pid;
 insert into public.group_audit(class_id,participant_id,actor_id,action,detail) values(c.id,pid,auth.uid(),'save_record',jsonb_build_object('mode','last_completed_set','entries',entries));
end $$;
create function public.group_save_last_sets(pid uuid, expected_revision integer, entries jsonb) returns void
language sql security invoker set search_path='' as $$ select private.group_save_last_sets(pid,expected_revision,entries); $$;
revoke all on function private.group_save_last_sets(uuid,integer,jsonb),public.group_save_last_sets(uuid,integer,jsonb) from public,anon,authenticated;
grant execute on function private.group_save_last_sets(uuid,integer,jsonb),public.group_save_last_sets(uuid,integer,jsonb) to authenticated;

-- Keep existing maxes/full-set logic as fallback. New summaries do not need a
-- second coach-confirmation action to contribute to the next class.
alter function private.group_recommend(uuid,uuid,text) rename to group_recommend_full_sets;
create function private.group_recommend(cid uuid,uid uuid,level text) returns jsonb
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
   where p.id::text=answer->(m->>'id')->>'source_id';
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
revoke all on function private.group_recommend(uuid,uuid,text),private.group_recommend_full_sets(uuid,uuid,text) from public,anon,authenticated;
notify pgrst,'reload schema';

-- Preserve the existing access/privacy boundary, including admin-only intent.
create function private.group_detail_last_sets(cid uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare r jsonb;
begin
 r:=private.group_detail_with_keys(cid);
 return jsonb_set(r,'{participants}',coalesce((select jsonb_agg(p||jsonb_build_object('last_sets',coalesce((select jsonb_object_agg(l.movement_id,to_jsonb(l)-'user_id'-'class_id'-'participant_id') from public.group_last_sets l where l.participant_id=(p->>'id')::uuid),'{}'::jsonb))) from jsonb_array_elements(r->'participants') p),'[]'::jsonb));
end $$;
create or replace function public.group_detail(cid uuid) returns jsonb
language sql stable security invoker set search_path='' as $$ select private.group_detail_last_sets(cid); $$;
revoke all on function private.group_detail_last_sets(uuid) from public,anon,authenticated;
grant execute on function private.group_detail_last_sets(uuid) to authenticated;
