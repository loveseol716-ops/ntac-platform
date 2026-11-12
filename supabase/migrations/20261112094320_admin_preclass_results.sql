-- Explicit administrator entries may be recorded before the class clock starts.
-- Ordinary members/coaches keep the original timing and participation checks.
do $$ declare body text;
 anchor text:='if c.archived_at is not null or phase not in (''live'',''ended'') or p.status not in (''active'',''completed'') then';
begin
 select pg_get_functiondef('private.group_save_last_sets(uuid,integer,jsonb)'::regprocedure) into body;
 if position(anchor in body)=0 then raise exception 'Last-set timing guard not found';end if;
 body:=replace(body,anchor,'if c.archived_at is not null or phase in (''draft'',''cancelled'') or p.status not in (''planned'',''active'',''completed'') or (not public.is_ntac_admin() and (phase not in (''live'',''ended'') or p.status=''planned'')) then');
 execute body;
 -- A saved summary is a real explicit record even when its class is scheduled
 -- later. Use its server save time; continue to exclude later/same target classes.
 select pg_get_functiondef('private.group_recommend(uuid,uuid,text)'::regprocedure) into body;
 if position('and pc.starts_at<now()' in body)=0 then raise exception 'Summary save-time guard not found';end if;
 body:=replace(body,'and pc.starts_at<now()','and l.updated_at<=now()');
 execute body;
end $$;
