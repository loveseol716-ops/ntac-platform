-- Unpublishing retains the week, occurrences and personal history for reuse.
-- Match the publisher's lock order and require the revision seen by the admin.
create function private.group_unpublish_week(target_id uuid, expected_revision integer)
returns void language plpgsql security definer set search_path='' as $$
declare w public.group_weeks;
begin
 if auth.uid() is null or not public.is_ntac_admin() then
  raise exception '관리자만 주간 프로그램의 공개를 취소할 수 있어요.';
 end if;
 perform 1 from public.group_timetable where id for update;
 select * into w from public.group_weeks where id=target_id for update;
 if not found or w.status='archived' then raise exception '주간 프로그램을 찾을 수 없어요. 다시 불러와 주세요.'; end if;
 if w.revision is distinct from expected_revision then raise exception '주간 프로그램이 변경됐어요. 다시 불러와 주세요.'; end if;
 if w.status='draft' then return; end if;
 update public.group_weeks set status='draft', revision=revision+1, updated_at=now() where id=target_id;
 insert into public.group_audit(actor_id,action,detail)
 values(auth.uid(),'unpublish_week',jsonb_build_object('before',to_jsonb(w)));
end $$;
create function public.group_unpublish_week(target_id uuid, expected_revision integer)
returns void language sql security invoker set search_path='' as $$
 select private.group_unpublish_week(target_id,expected_revision);
$$;
revoke all on function private.group_unpublish_week(uuid,integer),public.group_unpublish_week(uuid,integer) from public,anon,authenticated;
grant execute on function private.group_unpublish_week(uuid,integer),public.group_unpublish_week(uuid,integer) to authenticated;

-- Old occurrences must not leak a withdrawn/deleted week's program through
-- calendars or direct detail links. Staff retain their existing scoped access;
-- members retain their own results through the reduced history projection.
create or replace function private.group_access(cid uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and (
  private.group_manage(cid) or (
   exists(select 1 from public.group_classes c where c.id=cid
    and c.starts_at >= (private.group_program_visible_from()::timestamp at time zone 'Asia/Seoul')
    and (c.week_id is null or exists(select 1 from public.group_weeks w where w.id=c.week_id and w.status='published')))
   and (
    exists(select 1 from public.group_participants p where p.class_id=cid and p.user_id=auth.uid())
    or (exists(select 1 from public.group_members m where m.user_id=auth.uid() and m.active)
     and exists(select 1 from public.group_classes c where c.id=cid and c.status<>'draft' and c.archived_at is null))
   )
  )
 );
$$;

-- Block direct RPC joins too, including previously rostered participants.
do $$ declare body text; anchor text := 'phase:=private.group_class_phase(c.status,c.starts_at,c.duration_minutes);';
begin
 select pg_get_functiondef('public.group_join(uuid,uuid[],boolean)'::regprocedure) into body;
 if position(anchor in body)=0 then raise exception 'group_join phase guard not found'; end if;
 body:=replace(body,anchor,
  'if not private.group_manage(cid) and c.week_id is not null and not exists(select 1 from public.group_weeks w where w.id=c.week_id and w.status=''published'') then raise exception ''공개가 취소되거나 삭제된 주간 프로그램이에요.''; end if; ' || anchor);
 execute body;
end $$;
notify pgrst,'reload schema';
