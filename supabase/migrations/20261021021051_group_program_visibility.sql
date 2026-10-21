-- Retain all data. The member program window begins last Monday in Seoul.
create function private.group_program_visible_from() returns date
language sql stable security invoker set search_path='' as $$
 select (date_trunc('week', now() at time zone 'Asia/Seoul') - interval '7 days')::date;
$$;
revoke all on function private.group_program_visible_from() from public,anon,authenticated;
grant execute on function private.group_program_visible_from() to authenticated;

create or replace function private.group_access(cid uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and (
   private.group_manage(cid) or (
     exists(select 1 from public.group_classes c where c.id=cid
       and c.starts_at >= (private.group_program_visible_from()::timestamp at time zone 'Asia/Seoul'))
     and (
       exists(select 1 from public.group_participants p where p.class_id=cid and p.user_id=auth.uid())
       or (exists(select 1 from public.group_members m where m.user_id=auth.uid() and m.active)
         and exists(select 1 from public.group_classes c where c.id=cid and c.status<>'draft' and c.archived_at is null))
     )
   )
 );
$$;

alter policy group_weeks_read on public.group_weeks using (
 (select private.group_staff()) or (
   status='published' and week_start >= (select private.group_program_visible_from())
   and exists(select 1 from public.group_members where user_id=(select auth.uid()) and active)
 )
);

create or replace function public.group_bootstrap() returns jsonb
language sql stable security invoker set search_path='' as $$
 select jsonb_build_object(
   'member',(select to_jsonb(m) from public.group_members m where user_id=auth.uid()),
   'has_history',exists(select 1 from public.group_participants where user_id=auth.uid()),
   'program_visible_from',private.group_program_visible_from());
$$;

-- Restricted projection for the caller's own records. Old program bodies and
-- prescriptions never leave this helper. A caller cannot choose another user.
create function private.group_my_history() returns jsonb
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
         'exercise_id',m->>'exercise_id','kind',m->>'kind','unit',m->>'unit'
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
create function public.group_my_history() returns jsonb
language sql stable security invoker set search_path='' as $$
 select private.group_my_history();
$$;
revoke all on function private.group_my_history(),public.group_my_history() from public,anon,authenticated;
grant execute on function private.group_my_history(),public.group_my_history() to authenticated;

-- Expired programs also leave the shared TV display.
create or replace function public.group_display(display_token text) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare t private.group_display_tokens; w public.group_walls; c public.group_classes;
begin
 if length(coalesce(display_token,''))<>72 then raise exception 'TV 연결 링크를 확인해 주세요.'; end if;
 select * into t from private.group_display_tokens where token_hash=encode(sha256(convert_to(display_token,'UTF8')),'hex') and not revoked and expires_at>now();
 if not found then raise exception 'TV 연결이 해제됐거나 만료됐어요. 관리자에게 새 링크를 요청해 주세요.'; end if;
 select * into w from public.group_walls where id=t.wall_id;
 select * into c from public.group_classes where id=w.class_id and status in ('open','live','ended') and archived_at is null and starts_at >= (private.group_program_visible_from()::timestamp at time zone 'Asia/Seoul');
 return jsonb_build_object('kind',t.kind,'wall',w.title,'updated_at',now(),'movement_id',w.movement_id,
 'class',case when c.id is null then null else jsonb_build_object('id',c.id,'title',c.title,'starts_at',c.starts_at,'status',c.status,'movements',c.movements,'program_version',c.program_version) end,
 'participants',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'name',g.nickname,'status',p.status,'difficulty',p.difficulty,'finalized',p.finalized,
 'recommendations',case when t.kind='recommendations' then (select jsonb_object_agg(k,jsonb_build_object('weight',v->'weight','source',v->'source','sets',(select jsonb_agg(jsonb_build_object('weight',ss->'weight','reps',ss->'reps','rir',ss->'rir','source',ss->'source')) from jsonb_array_elements(coalesce(v->'sets','[]')) ss))) from jsonb_each(p.recommendations) x(k,v)) else null end,
 'results',case when t.kind='results' then p.results else null end) order by p.joined_at)
 from public.group_participants p join public.group_members g on g.user_id=p.user_id where p.class_id=c.id and p.status in ('active','completed') and g.show_on_tv and length(trim(g.nickname))>0),'[]'));
end $$;

notify pgrst,'reload schema';
