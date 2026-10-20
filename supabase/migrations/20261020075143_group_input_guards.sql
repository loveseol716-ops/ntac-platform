-- Null inputs must never bypass access checks or optimistic concurrency.
create or replace function public.group_join(cid uuid, user_ids uuid[] default null, allow_exception boolean default false) returns jsonb language plpgsql security definer set search_path='' as $$
declare c public.group_classes; uid uuid; p public.group_participants; ids uuid[]; added integer:=0; existing integer:=0; eligible boolean;
begin
 allow_exception:=coalesce(allow_exception,false);
 if auth.uid() is null then raise exception '로그인이 필요해요.'; end if;
 select * into c from public.group_classes where id=cid for update;
 if not found or c.status not in ('open','live') or (c.starts_at at time zone 'Asia/Seoul')::date<>(now() at time zone 'Asia/Seoul')::date then raise exception '오늘 참가 접수가 열린 수업을 선택해 주세요.'; end if;
 ids:=coalesce(user_ids,array[auth.uid()]);
 if cardinality(ids) not between 1 and 100 then raise exception '최대 100명까지 선택할 수 있어요.'; end if;
 if (user_ids is not null or allow_exception) and not private.group_manage(cid) then raise exception '담당 코치만 참가자를 추가할 수 있어요.'; end if;
 if allow_exception and not public.is_ntac_admin() then raise exception '일회 참가 예외는 관리자만 허용할 수 있어요.'; end if;
 foreach uid in array ids loop
  if uid is null then raise exception '회원을 선택해 주세요.'; end if;
  select * into p from public.group_participants where class_id=cid and user_id=uid;
  if found and p.status in ('active','completed') then existing:=existing+1;continue; end if;
  eligible:=exists(select 1 from public.group_members where user_id=uid and active);
  if not eligible and not allow_exception then raise exception '그룹 이용 권한이 없는 회원이 있어요. 관리자가 권한을 지정해 주세요.'; end if;
  insert into public.group_members(user_id,active) values(uid,false) on conflict(user_id) do nothing;
  insert into public.group_participants(class_id,user_id,recommendations,exception_access)
  values(cid,uid,private.group_recommend(cid,uid,'standard'),not eligible)
  on conflict(class_id,user_id) do update set status='active',completed_at=null,exception_access=excluded.exception_access,revision=group_participants.revision+1,updated_at=now() returning * into p;
  insert into public.group_audit(class_id,participant_id,actor_id,action,detail) values(cid,p.id,auth.uid(),'join',jsonb_build_object('exception',not eligible));added:=added+1;
 end loop;
 return jsonb_build_object('added',added,'existing',existing);
end $$;

create or replace function public.group_set_class_status(cid uuid, next_status text, expected_revision integer) returns void language plpgsql security definer set search_path='' as $$
declare c public.group_classes;
begin
 if not private.group_manage(cid) then raise exception '담당 수업만 운영할 수 있어요.'; end if;
 select * into c from public.group_classes where id=cid for update;
 if c.revision is distinct from expected_revision then raise exception '수업 상태가 변경됐어요. 새로고침해 주세요.'; end if;
 if c.status=next_status then return; end if;
 if not ((c.status='draft' and next_status in ('published','cancelled')) or (c.status='published' and next_status in ('draft','open','cancelled')) or (c.status='open' and next_status in ('live','ended','cancelled')) or (c.status='live' and next_status in ('ended','cancelled'))) then raise exception '허용되지 않은 수업 상태 변경이에요.'; end if;
 if next_status in ('open','live') and (c.starts_at at time zone 'Asia/Seoul')::date<>(now() at time zone 'Asia/Seoul')::date then raise exception '참가 접수와 수업 시작은 당일에만 가능해요.'; end if;
 update public.group_classes set status=next_status,ended_at=case when next_status='ended' then now() else ended_at end,revision=revision+1,updated_at=now() where id=cid;
 insert into public.group_audit(class_id,actor_id,action,detail) values(cid,auth.uid(),'class_status',jsonb_build_object('from',c.status,'to',next_status));
end $$;

create or replace function public.group_save_participant(pid uuid, expected_revision integer, payload jsonb) returns void language plpgsql security definer set search_path='' as $$
declare p public.group_participants; c public.group_classes; manager boolean; newstate text; newlevel text; r jsonb; m jsonb; k text; v text; clean jsonb := '{}'; rec jsonb; reason text;
begin
 select cl.* into c from public.group_classes cl join public.group_participants pp on pp.class_id=cl.id where pp.id=pid for update of cl;
 select * into p from public.group_participants where id=pid for update;
 if not found then raise exception '참가 정보를 찾을 수 없어요.'; end if;
 manager:=private.group_manage(p.class_id);
 if auth.uid() is null or (not manager and p.user_id<>auth.uid()) then raise exception '본인 또는 담당 코치만 기록을 저장할 수 있어요.'; end if;
 if p.revision is distinct from expected_revision then raise exception '다른 기기에서 기록이 바뀌었어요. 새로고침 후 다시 입력해 주세요.'; end if;
 if c.status in ('draft','published','cancelled') then raise exception '기록을 입력할 수 없는 수업이에요.'; end if;
 if not manager and (p.finalized or (c.status='ended' and now()>c.ended_at+interval '24 hours')) then raise exception '기록 수정 기간이 끝났어요. 코치에게 요청해 주세요.'; end if;
 newstate:=coalesce(payload->>'status',p.status);newlevel:=coalesce(payload->>'difficulty',p.difficulty);
 if newstate not in ('active','completed','left','cancelled') or newlevel not in ('foundation','standard','advanced') then raise exception '상태와 난이도를 확인해 주세요.'; end if;
 if p.status in ('left','cancelled') and newstate in ('active','completed') then raise exception '운동 시작으로 다시 참가한 뒤 기록해 주세요.'; end if;
 if newlevel<>p.difficulty and not manager then raise exception '난이도 변경은 코치에게 요청해 주세요.'; end if;
 if newstate='completed' and c.starts_at>now() then raise exception '수업 시작 이후 완료할 수 있어요.'; end if;
 if payload ? 'finalized' and not manager then raise exception '기록 확정은 코치만 가능해요.'; end if;
 r:=coalesce(payload->'results',p.results);
 if jsonb_typeof(r)<>'object' or pg_column_size(r)>30000 then raise exception '기록 형식을 확인해 주세요.'; end if;
 for k in select jsonb_object_keys(r) loop
  select value into m from jsonb_array_elements(c.movements) where value->>'id'=k;
  if m is null or jsonb_typeof(r->k)<>'object' then raise exception '프로그램에 있는 운동만 기록할 수 있어요.'; end if;
  for v in select jsonb_object_keys(r->k) loop
   if v not in ('weight','reps','seconds','rounds','distance','calories','dnf') then raise exception '허용되지 않은 기록 항목이에요.'; end if;
   if v<>'dnf' and jsonb_typeof(r->k->v) not in ('number','null') then raise exception '기록은 숫자로 입력해 주세요.'; end if;
   if v in ('reps','rounds') and r->k->>v is not null and (r->k->>v)::numeric<>trunc((r->k->>v)::numeric) then raise exception '반복 수와 라운드는 정수로 입력해 주세요.'; end if;
   if v='dnf' and jsonb_typeof(r->k->v)<>'boolean' then raise exception '완주 여부를 확인해 주세요.'; end if;
   if v<>'dnf' and r->k->>v is not null and ((r->k->>v)::numeric<0 or (r->k->>v)::numeric>1000000 or (r->k->>v)::text in ('NaN','Infinity','-Infinity')) then raise exception '기록은 0 이상의 유효한 숫자로 입력해 주세요.'; end if;
  end loop;
  if coalesce((r->k->>'dnf')::boolean,false) not in (true,false) then raise exception '완주 여부를 확인해 주세요.'; end if;
  clean:=clean||jsonb_build_object(k,r->k);
 end loop;
 rec:=p.recommendations;
 if newlevel<>p.difficulty then rec:=private.group_recommend(p.class_id,p.user_id,newlevel); end if;
 if payload ? 'recommendations' then
  if not manager then raise exception '추천 조정은 코치만 가능해요.'; end if;
  reason:=trim(coalesce(payload->>'reason',''));
  if length(reason) not between 1 and 300 then raise exception '추천 조정 이유를 입력해 주세요.'; end if;
  for k in select jsonb_object_keys(payload->'recommendations') loop
   select value into m from jsonb_array_elements(c.movements) where value->>'id'=k and value->>'kind'='weight';
   if m is null or coalesce((payload->'recommendations'->>k)::numeric,-1) not between 0 and 2000 then raise exception '조정할 운동과 중량을 확인해 주세요.'; end if;
   rec:=rec||jsonb_build_object(k,jsonb_build_object('weight',(payload->'recommendations'->>k)::numeric,'source','coach_override','reason',reason,'program_version',c.program_version,'rule_version','coach-v1','created_at',now()));
  end loop;
 end if;
 update public.group_participants set results=clean,recommendations=rec,status=newstate,difficulty=newlevel,note=coalesce(payload->>'note',note),finalized=coalesce((payload->>'finalized')::boolean,finalized),completed_at=case when newstate='completed' then coalesce(completed_at,now()) else null end,revision=revision+1,updated_at=now() where id=pid;
 insert into public.group_audit(class_id,participant_id,actor_id,action,detail) values(p.class_id,pid,auth.uid(),'save_record',jsonb_build_object('before',to_jsonb(p),'changes',payload));
end $$;
notify pgrst,'reload schema';
