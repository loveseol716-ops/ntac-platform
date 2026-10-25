-- Deleting a week must also remove its past occurrences from operational
-- calendars. Keep the underlying rows and member results in the archive.
do $$
declare body text;
 old_filter text := 'where week_id=target_id and status in (''draft'',''published'') and starts_at>now() and archived_at is null order by id for update loop';
 old_update text := 'update public.group_classes set archived_at=now(),status=''cancelled'',revision=revision+1,updated_at=now() where id=c.id;';
begin
 select pg_get_functiondef('public.group_remove_program(text,uuid,integer)'::regprocedure) into body;
 if position(old_filter in body)=0 or position(old_update in body)=0 then raise exception 'Week deletion guard not found'; end if;
 body:=replace(body,old_filter,'where week_id=target_id and archived_at is null order by id for update loop');
 body:=replace(body,old_update,'update public.group_classes set archived_at=now(),status=case when private.group_class_phase(c.status,c.starts_at,c.duration_minutes)=''ended'' then ''ended'' else ''cancelled'' end,revision=revision+1,updated_at=now() where id=c.id;');
 execute body;
end $$;

-- Repair only occurrences of weeks that an administrator has already deleted.
-- Started/completed participation and recorded results are never removed.
update public.group_classes c
set archived_at=now(),
 status=case when private.group_class_phase(c.status,c.starts_at,c.duration_minutes)='ended' then 'ended' else 'cancelled' end,
 revision=c.revision+1,updated_at=now()
where c.archived_at is null and exists(select 1 from public.group_weeks w where w.id=c.week_id and w.status='archived');
update public.group_participants p set status='cancelled',revision=p.revision+1,updated_at=now()
where p.status='planned' and exists(
 select 1 from public.group_classes c join public.group_weeks w on w.id=c.week_id
 where c.id=p.class_id and w.status='archived' and c.archived_at is not null
);
notify pgrst,'reload schema';
