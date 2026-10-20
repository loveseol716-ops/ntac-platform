-- Atomic service assignment; independent of staff roles and of workout/pass history.
create function public.set_member_services_v3(
 target_id uuid, enable_ntac boolean, enable_pt boolean, enable_group boolean,
 ntac_coach_id uuid default null, pt_coach_id uuid default null, expected_state jsonb default null
) returns void language plpgsql security invoker set search_path='' as $$
declare p public.profiles; current_state jsonb;
begin
 if auth.uid() is null or not public.is_ntac_admin() then raise exception '관리자만 회원의 이용 서비스를 변경할 수 있어요.';end if;
 if enable_ntac is null or enable_pt is null or enable_group is null then raise exception '세 서비스의 이용 여부를 모두 선택해 주세요.';end if;
 select * into p from public.profiles where id=target_id for update;
 if not found then raise exception '회원을 찾을 수 없습니다.';end if;
 select jsonb_build_object('ntac',p.ntac_enabled,'pt',coalesce(m.active,false),'group',coalesce(g.active,false),'ntac_coach_id',p.assigned_coach_id,'pt_coach_id',m.coach_id)
 into current_state from (select 1) x left join public.pt_members m on m.profile_id=p.id left join public.group_members g on g.user_id=p.id;
 if expected_state is distinct from current_state then raise exception '이용 서비스가 다른 화면에서 변경됐어요. 창을 닫고 새로고침한 후 다시 설정해 주세요.';end if;
 if (ntac_coach_id is not null and not exists(select 1 from public.profiles where id=ntac_coach_id and role in ('owner','admin','coach')))
 or (pt_coach_id is not null and not exists(select 1 from public.profiles where id=pt_coach_id and role in ('owner','admin','coach'))) then raise exception '등록된 코치를 선택해 주세요.';end if;
 perform public.set_member_services_v2(target_id,enable_ntac,enable_pt,ntac_coach_id,pt_coach_id);
 -- This guarded API preserves nickname, TV consent, prior participation and all results.
 if enable_group is distinct from (current_state->>'group')::boolean then
  perform public.group_set_member(target_id,enable_group);
 end if;
end $$;
revoke all on function public.set_member_services_v3(uuid,boolean,boolean,boolean,uuid,uuid,jsonb) from public,anon;
grant execute on function public.set_member_services_v3(uuid,boolean,boolean,boolean,uuid,uuid,jsonb) to authenticated;
notify pgrst,'reload schema';
