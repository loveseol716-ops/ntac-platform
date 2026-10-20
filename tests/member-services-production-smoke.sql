-- Rollback-only service combinations and the password handler's exact RLS lookups.
begin;
do $$
declare actor record; uid uuid; ownerid uuid; coachid uuid; p public.profiles; state jsonb; before_results jsonb; after_results jsonb; bits int;
begin
 select id into uid from public.profiles where role='member' order by id limit 1;
 select id into ownerid from public.profiles where role='owner' order by id limit 1;
 select id into coachid from public.profiles where role in ('admin','coach') order by id limit 1;
 if coachid is null then coachid:=ownerid;end if;
 select jsonb_build_object('group',(select jsonb_agg(to_jsonb(gp) order by gp.id) from public.group_participants gp where gp.user_id=uid),'pt',(select jsonb_agg(to_jsonb(ps) order by ps.id) from public.pt_sessions ps join public.pt_members pm on pm.id=ps.member_id where pm.profile_id=uid),'packages',(select jsonb_agg(to_jsonb(pk) order by pk.id) from public.pt_packages pk join public.pt_members pm on pm.id=pk.member_id where pm.profile_id=uid)) into before_results;
 for actor in select id,role from public.profiles where role in ('owner','admin') loop
  perform set_config('request.jwt.claim.sub',actor.id::text,true);perform set_config('role','authenticated',true);
  select * into p from public.profiles where id=actor.id;
  if p.role not in ('owner','admin') then raise exception 'Caller role lookup failed';end if;
  if not exists(select 1 from public.profiles where id=uid and role='member') then raise exception 'Password target lookup failed';end if;
  perform set_config('role','none',true);
 end loop;
 perform set_config('request.jwt.claim.sub',ownerid::text,true);perform set_config('role','authenticated',true);
 for bits in 0..7 loop
  select jsonb_build_object('ntac',pr.ntac_enabled,'pt',coalesce(m.active,false),'group',coalesce(g.active,false),'ntac_coach_id',pr.assigned_coach_id,'pt_coach_id',m.coach_id) into state from public.profiles pr left join public.pt_members m on m.profile_id=pr.id left join public.group_members g on g.user_id=pr.id where pr.id=uid;
  perform public.set_member_services_v3(uid,(bits&1)>0,(bits&2)>0,(bits&4)>0,ownerid,coachid,state);
  if not exists(select 1 from public.profiles pr left join public.pt_members m on m.profile_id=pr.id left join public.group_members g on g.user_id=pr.id where pr.id=uid and pr.ntac_enabled=((bits&1)>0) and coalesce(m.active,false)=((bits&2)>0) and coalesce(g.active,false)=((bits&4)>0) and pr.role='member' and pr.assigned_coach_id=ownerid and (m.coach_id=coachid or (m.id is null and (bits&2)=0))) then raise exception 'Service combination % failed',bits;end if;
 end loop;
 begin perform public.set_member_services_v3(uid,false,false,false,null,null,null);raise exception 'Missing expected state allowed';exception when raise_exception then if SQLERRM not like '%다른 화면%' then raise;end if;end;
 select jsonb_build_object('group',(select jsonb_agg(to_jsonb(gp) order by gp.id) from public.group_participants gp where gp.user_id=uid),'pt',(select jsonb_agg(to_jsonb(ps) order by ps.id) from public.pt_sessions ps join public.pt_members pm on pm.id=ps.member_id where pm.profile_id=uid),'packages',(select jsonb_agg(to_jsonb(pk) order by pk.id) from public.pt_packages pk join public.pt_members pm on pm.id=pk.member_id where pm.profile_id=uid)) into after_results;
 if before_results is distinct from after_results then raise exception 'Service assignment changed workout/pass history';end if;
 perform set_config('request.jwt.claim.sub',uid::text,true);
 begin perform public.set_member_services_v3(uid,true,true,true,null,null,state);raise exception 'Member escalated services';exception when raise_exception then if SQLERRM not like '관리자만%' then raise;end if;end;
 perform set_config('role','none',true);
end $$;
rollback;
select 'PASS: owner/admin password-role lookups using authenticated RLS, eight service combinations, independent coaches, stale/member denials and record/pass preservation; all test changes rolled back' as result;
