-- Reuse durable attendance/results; history never exposes expired program bodies
-- or administrator-only intentions. Self and administrators share one read API.
create function private.group_training_history(target_user_id uuid default null, exercise_id_filter text default null, history_offset integer default 0) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare uid uuid:=coalesce(target_user_id,auth.uid()); answer jsonb;
begin
 if auth.uid() is null then raise exception '로그인이 필요해요.';end if;
 if uid<>auth.uid() and not public.is_ntac_admin() then raise exception '본인 또는 관리자만 운동 기록을 볼 수 있어요.';end if;
 if history_offset is null or history_offset not between 0 and 1000000 then raise exception '기록 조회 위치를 확인해 주세요.';end if;
 with matching as (
  select p.*,c.title,c.starts_at,c.duration_minutes,c.status as class_status,c.movements
  from public.group_participants p join public.group_classes c on c.id=p.class_id
  where p.user_id=uid and p.status in ('active','completed','left') and (exercise_id_filter is null or exists(
   select 1 from jsonb_array_elements(c.movements) m where m->>'exercise_id'=exercise_id_filter and p.results ? (m->>'id')
  ))
 ), page as (
  select * from matching order by starts_at desc,id desc limit 51 offset history_offset
 ), visible as (
  select * from page order by starts_at desc,id desc limit 50
 )
 select jsonb_build_object(
  'total',(select count(*) from matching),
  'completed',(select count(*) from matching where status='completed'),
  'has_more',(select count(*)>50 from page),
  'records',coalesce((select jsonb_agg(jsonb_build_object(
   'id',p.id,'class_id',p.class_id,'status',p.status,'joined_at',p.joined_at,'completed_at',p.completed_at,
   'results',p.results,'session_rpe',p.session_rpe,'note',p.note,
   'last_sets',coalesce((select jsonb_object_agg(l.movement_id,jsonb_build_object('weight',l.weight,'reps',l.reps,'rpe',l.rpe,'set_index',l.set_index)) from public.group_last_sets l where l.participant_id=p.id),'{}'::jsonb),
   'group_classes',jsonb_build_object('id',p.class_id,'title',p.title,'starts_at',p.starts_at,'duration_minutes',p.duration_minutes,'status',p.class_status,
    'movements',coalesce((select jsonb_agg(jsonb_build_object('id',m->>'id','exercise_id',m->>'exercise_id','label',coalesce(nullif(m->>'label',''),e.name,m->>'exercise_id'),'kind',m->>'kind','unit',m->>'unit','training_type',m->>'training_type') order by ord)
     from jsonb_array_elements(p.movements) with ordinality moves(m,ord) left join public.group_exercises e on e.id=m->>'exercise_id'
     where p.results ? (m->>'id')),'[]'::jsonb))
  ) order by p.starts_at desc,p.id desc) from visible p),'[]'::jsonb)
 ) into answer;
 return answer;
end $$;
create function public.group_training_history(target_user_id uuid default null, exercise_id_filter text default null, history_offset integer default 0) returns jsonb
language sql stable security invoker set search_path='' as $$ select private.group_training_history(target_user_id,exercise_id_filter,history_offset); $$;
revoke all on function private.group_training_history(uuid,text,integer),public.group_training_history(uuid,text,integer) from public,anon,authenticated;
grant execute on function private.group_training_history(uuid,text,integer),public.group_training_history(uuid,text,integer) to authenticated;
notify pgrst,'reload schema';
