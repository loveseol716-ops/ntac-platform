-- Only administrators bypass the attendance time window. Retain published-week,
-- membership/exception, duplicate, archive and draft/cancelled guards unchanged.
do $$ declare body text;
 anchor text:='if not planned and phase not in (''open'',''live'') then';
begin
 select pg_get_functiondef('public.group_join(uuid,uuid[],boolean)'::regprocedure) into body;
 if position(anchor in body)=0 then raise exception 'group_join time guard not found';end if;
 body:=replace(body,anchor,'if not planned and phase not in (''open'',''live'') and not (public.is_ntac_admin() and phase in (''published'',''ended'')) then');
 execute body;
end $$;

-- Class-manager-only basic identifiers. Do not expose full phone or birth date.
create function private.group_floor_directory(cid uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null or not private.group_manage(cid) then raise exception '관리자 또는 담당 코치만 조회할 수 있어요.';end if;
 if not exists(select 1 from public.group_classes c where c.id=cid) then raise exception '수업을 확인해 주세요.';end if;
 return coalesce((select jsonb_agg(jsonb_build_object(
  'id',p.id,'name',p.full_name,'active',coalesce(g.active,false),'role',p.role,
  'email',case when public.is_ntac_admin() then p.email else null end,
  'sex',case when public.is_ntac_admin() then to_jsonb(p)->>'sex' else null end,
  'age',case when public.is_ntac_admin() then extract(year from age((now() at time zone 'Asia/Seoul')::date,nullif(to_jsonb(p)->>'birth_date','')::date))::integer else null end,
  'phone_suffix',case when public.is_ntac_admin() then nullif(right(regexp_replace(coalesce(to_jsonb(p)->>'phone',''),'[^0-9]','','g'),4),'') else null end
 ) order by p.full_name) from public.profiles p left join public.group_members g on g.user_id=p.id
 where public.is_ntac_admin() or g.active or exists(select 1 from public.group_participants pp where pp.class_id=cid and pp.user_id=p.id)),'[]'::jsonb);
end $$;
create function public.group_floor_directory(cid uuid) returns jsonb
language sql stable security invoker set search_path='' as $$ select private.group_floor_directory(cid); $$;
revoke all on function private.group_floor_directory(uuid),public.group_floor_directory(uuid) from public,anon,authenticated;
grant execute on function private.group_floor_directory(uuid),public.group_floor_directory(uuid) to authenticated;
notify pgrst,'reload schema';
