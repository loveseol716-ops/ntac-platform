-- Derive the lifecycle from server time. Never infer attendance or fabricate results.
create or replace function private.group_class_phase(state text, starts timestamptz, duration integer, at_time timestamptz default now())
returns text language sql stable security invoker set search_path='' as $$
 select case when state in ('draft','cancelled','ended') then state
   when at_time >= starts + make_interval(mins=>duration) then 'ended'
   when at_time >= starts then 'live'
   when at_time >= starts - interval '30 minutes' then 'open'
   else 'published' end;
$$;
revoke all on function private.group_class_phase(text,timestamptz,integer,timestamptz) from public,anon,authenticated;
grant execute on function private.group_class_phase(text,timestamptz,integer,timestamptz) to authenticated;

-- Both TVs use this same deterministic, server-side selection, irrespective of
-- which administrator is signed in or which old manual class a wall referenced.
create or replace function private.group_display_class(at_time timestamptz default now())
returns uuid language sql stable security definer set search_path='' as $$
 select c.id from public.group_classes c
 where c.archived_at is null and c.status in ('published','open','live','ended')
   and c.starts_at >= (date_trunc('day',at_time at time zone 'Asia/Seoul') at time zone 'Asia/Seoul') - interval '4 hours'
   and c.starts_at <= at_time + interval '30 minutes'
   and (c.starts_at + make_interval(mins=>c.duration_minutes) > at_time
     or (c.starts_at at time zone 'Asia/Seoul')::date = (at_time at time zone 'Asia/Seoul')::date)
 order by
   case when c.status<>'ended' and c.starts_at<=at_time and c.starts_at+make_interval(mins=>c.duration_minutes)>at_time then 0
        when c.status<>'ended' and c.starts_at>at_time then 1 else 2 end,
   case when c.starts_at>at_time then c.starts_at end asc,
   c.starts_at desc,c.id
 limit 1;
$$;
revoke all on function private.group_display_class(timestamptz) from public,anon,authenticated;

CREATE OR REPLACE FUNCTION public.group_join(cid uuid, user_ids uuid[] DEFAULT NULL::uuid[], allow_exception boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare c public.group_classes; uid uuid; p public.group_participants; ids uuid[]; added integer:=0; existing integer:=0; eligible boolean; planned boolean; nextstate text; phase text;
begin
 allow_exception:=coalesce(allow_exception,false);
 if auth.uid() is null then raise exception '로그인이 필요해요.'; end if;
 select * into c from public.group_classes where id=cid for update;
 if not found or c.archived_at is not null then raise exception '참가할 수업을 확인해 주세요.'; end if;
 phase:=private.group_class_phase(c.status,c.starts_at,c.duration_minutes);
 planned:=user_ids is not null and private.group_manage(cid) and phase='published' and c.starts_at>now();
 if not planned and phase not in ('open','live') then raise exception '수업 시작 30분 전부터 종료 시간까지 참여할 수 있어요.'; end if;
 nextstate:=case when planned then 'planned' else 'active' end;
 ids:=coalesce(user_ids,array[auth.uid()]);
 if cardinality(ids) not between 1 and 100 then raise exception '최대 100명까지 선택할 수 있어요.'; end if;
 if (user_ids is not null or allow_exception) and not private.group_manage(cid) then raise exception '담당 코치만 참가자를 추가할 수 있어요.'; end if;
 if allow_exception and not public.is_ntac_admin() then raise exception '일회 참가 예외는 관리자만 허용할 수 있어요.'; end if;
 foreach uid in array ids loop
  if uid is null then raise exception '회원을 선택해 주세요.'; end if;
  select * into p from public.group_participants where class_id=cid and user_id=uid;
  if found and (p.status in ('active','completed') or (planned and p.status='planned')) then existing:=existing+1;continue; end if;
  eligible:=exists(select 1 from public.group_members where user_id=uid and active);
  if not eligible and not allow_exception and not coalesce(p.status='planned' and p.exception_access,false) then raise exception '그룹 이용 권한이 없는 회원이 있어요. 관리자가 권한을 지정해 주세요.'; end if;
  insert into public.group_members(user_id,active) values(uid,false) on conflict(user_id) do nothing;
  insert into public.group_participants(class_id,user_id,recommendations,exception_access,status)
  values(cid,uid,private.group_recommend(cid,uid,coalesce(p.difficulty,'standard')),not eligible,nextstate)
  on conflict(class_id,user_id) do update set status=excluded.status,recommendations=case when group_participants.status='planned' then excluded.recommendations else group_participants.recommendations end,completed_at=null,exception_access=excluded.exception_access,revision=group_participants.revision+1,updated_at=now() returning * into p;
  insert into public.group_audit(class_id,participant_id,actor_id,action,detail) values(cid,p.id,auth.uid(),'join',jsonb_build_object('exception',not eligible));added:=added+1;
 end loop;
 return jsonb_build_object('added',added,'existing',existing);
end $function$
;
CREATE OR REPLACE FUNCTION public.group_save_participant(pid uuid, expected_revision integer, payload jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare p public.group_participants; c public.group_classes; manager boolean; newstate text; newlevel text; r jsonb; m jsonb; k text; v text; clean jsonb := '{}'; rec jsonb; reason text; ss jsonb; field text; si integer; newrpe numeric; weights jsonb;
begin
 select cl.* into c from public.group_classes cl join public.group_participants pp on pp.class_id=cl.id where pp.id=pid for update of cl;
 select * into p from public.group_participants where id=pid for update;
 if not found then raise exception '참가 정보를 찾을 수 없어요.'; end if;
 manager:=private.group_manage(p.class_id);
 if auth.uid() is null or (not manager and p.user_id<>auth.uid()) then raise exception '본인 또는 담당 코치만 기록을 저장할 수 있어요.'; end if;
 if p.revision is distinct from expected_revision then raise exception '다른 기기에서 기록이 바뀌었어요. 새로고침 후 다시 입력해 주세요.'; end if;
 c.ended_at:=coalesce(c.ended_at,c.starts_at+make_interval(mins=>c.duration_minutes));
 c.status:=private.group_class_phase(c.status,c.starts_at,c.duration_minutes);
 if p.status='planned' then raise exception '먼저 수업 참여를 눌러 주세요.'; end if;
 if c.status in ('draft','published','cancelled') then raise exception '기록을 입력할 수 없는 수업이에요.'; end if;
 if not manager and (p.finalized or (c.status='ended' and now()>c.ended_at+interval '24 hours')) then raise exception '기록 수정 기간이 끝났어요. 코치에게 요청해 주세요.'; end if;
 newstate:=coalesce(payload->>'status',p.status);newlevel:=coalesce(payload->>'difficulty',p.difficulty);
 if newstate not in ('active','completed','left','cancelled') or newlevel not in ('foundation','standard','advanced') then raise exception '상태와 난이도를 확인해 주세요.'; end if;
 if p.status in ('left','cancelled') and newstate in ('active','completed') then raise exception '수업 참여로 다시 입장한 뒤 기록해 주세요.'; end if;
 if newlevel<>p.difficulty and not manager then raise exception '난이도 변경은 코치에게 요청해 주세요.'; end if;
 if newstate='completed' and c.starts_at>now() then raise exception '수업 시작 이후 완료할 수 있어요.'; end if;
 if payload ? 'finalized' and not manager then raise exception '기록 확정은 코치만 가능해요.'; end if;
 newrpe:=case when payload ? 'session_rpe' then (payload->>'session_rpe')::numeric else p.session_rpe end;
 if newrpe is not null and (newrpe<0 or newrpe>10 or newrpe::text in ('NaN','Infinity','-Infinity')) then raise exception '수업 전체 RPE는 0~10으로 입력해 주세요.'; end if;
 if newstate='completed' and c.recording_version>=2 and newrpe is null then raise exception '마지막으로 수업 전체 RPE를 선택해 주세요.'; end if;
 r:=coalesce(payload->'results',p.results);
 if jsonb_typeof(r) is distinct from 'object' or pg_column_size(r)>30000 then raise exception '기록 형식을 확인해 주세요.'; end if;
 for k in select jsonb_object_keys(r) loop
  select value into m from jsonb_array_elements(c.movements) where value->>'id'=k;
  if m is null or jsonb_typeof(r->k)<>'object' then raise exception '프로그램에 있는 운동만 기록할 수 있어요.'; end if;
  for v in select jsonb_object_keys(r->k) loop
   if v='sets' then
    if m->>'training_type' is distinct from 'strength' or jsonb_typeof(r->k->v) is distinct from 'array' then raise exception '스트렝스 세트 기록 형식을 확인해 주세요.'; end if;
    if jsonb_array_length(r->k->v)<>jsonb_array_length(m->'sets') then raise exception '프로그램과 세트 수가 달라요.'; end if;
    for ss in select value from jsonb_array_elements(r->k->v) loop
     if jsonb_typeof(ss) is distinct from 'object' then raise exception '세트 기록 형식을 확인해 주세요.'; end if;
     for field in select jsonb_object_keys(ss) loop
      if field not in ('weight','reps','rir','dnf') then raise exception '허용되지 않은 세트 기록이에요.'; end if;
      if field='dnf' then
       if jsonb_typeof(ss->field) is distinct from 'boolean' then raise exception '미완주 여부를 확인해 주세요.'; end if;
      else
       if jsonb_typeof(ss->field) not in ('number','null') or (ss->>field)::numeric<0 or (ss->>field)::numeric>(case field when 'rir' then 10 when 'weight' then 2000 else 1000 end) then raise exception '세트별 중량·반복·RIR 범위를 확인해 주세요.'; end if;
       if field='reps' and (ss->>field)::numeric<>trunc((ss->>field)::numeric) then raise exception '반복 수는 정수로 입력해 주세요.'; end if;
      end if;
     end loop;
    end loop;
    continue;
   end if;
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
   if m->>'training_type'='strength' then
    weights:=payload->'recommendations'->k;
    if jsonb_typeof(weights) is distinct from 'array' then raise exception '세트별 추천 중량을 입력해 주세요.'; end if;
    if jsonb_array_length(weights)<>jsonb_array_length(m->'sets') then raise exception '추천 세트 수를 확인해 주세요.'; end if;
    si:=0;r:='[]';
    for ss in select value from jsonb_array_elements(weights) loop
     if jsonb_typeof(ss) not in ('number','null') or (ss#>>'{}')::numeric not between 0 and 2000 then raise exception '추천 중량은 0~2000으로 입력해 주세요.'; end if;
     r:=r||jsonb_build_array((m->'sets'->si)||jsonb_build_object('weight',ss,'source','coach_override'));si:=si+1;
    end loop;
    rec:=rec||jsonb_build_object(k,jsonb_build_object('sets',r,'weight',r->0->'weight','source','coach_override','reason',reason,'rule_version','coach-v2','program_version',c.program_version));
    continue;
   end if;
   if m is null or coalesce((payload->'recommendations'->>k)::numeric,-1) not between 0 and 2000 then raise exception '조정할 운동과 중량을 확인해 주세요.'; end if;
   rec:=rec||jsonb_build_object(k,jsonb_build_object('weight',(payload->'recommendations'->>k)::numeric,'source','coach_override','reason',reason,'program_version',c.program_version,'rule_version','coach-v1','created_at',now()));
  end loop;
 end if;
 update public.group_participants set session_rpe=newrpe,results=clean,recommendations=rec,status=newstate,difficulty=newlevel,note=coalesce(payload->>'note',note),finalized=coalesce((payload->>'finalized')::boolean,finalized),completed_at=case when newstate='completed' then coalesce(completed_at,now()) else null end,revision=revision+1,updated_at=now() where id=pid;
 insert into public.group_audit(class_id,participant_id,actor_id,action,detail) values(p.class_id,pid,auth.uid(),'save_record',jsonb_build_object('before',to_jsonb(p),'changes',payload));
end $function$
;
CREATE OR REPLACE FUNCTION public.group_detail(cid uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
 if not private.group_access(cid) then raise exception '이 수업을 볼 권한이 없어요.'; end if;
 return jsonb_build_object('class',(select to_jsonb(c)||jsonb_build_object('stored_status',c.status,'status',private.group_class_phase(c.status,c.starts_at,c.duration_minutes),'scheduled_end_at',c.starts_at+make_interval(mins=>c.duration_minutes),'join_opens_at',c.starts_at-interval '30 minutes','ended_at',coalesce(c.ended_at,c.starts_at+make_interval(mins=>c.duration_minutes))) from public.group_classes c where id=cid),'can_manage',private.group_manage(cid),
 'participants',coalesce((select jsonb_agg(to_jsonb(p)||jsonb_build_object('name',pr.full_name,'nickname',g.nickname,'show_on_tv',g.show_on_tv) order by p.joined_at) from public.group_participants p join public.profiles pr on pr.id=p.user_id left join public.group_members g on g.user_id=p.user_id where p.class_id=cid and (p.user_id=auth.uid() or private.group_manage(cid))),'[]'));
end $function$
;
CREATE OR REPLACE FUNCTION public.group_save_class(payload jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare cid uuid := coalesce(nullif(payload->>'id','')::uuid,gen_random_uuid()); old public.group_classes; coach uuid := (payload->>'coach_id')::uuid;
begin
 if not private.group_staff() then raise exception '코치 권한이 필요해요.'; end if;
 select * into old from public.group_classes where id=cid for update;
 if found then
  if not private.group_manage(cid) then raise exception '담당 수업만 수정할 수 있어요.'; end if;
  if old.revision<>coalesce((payload->>'revision')::integer,0) then raise exception '수업이 변경됐어요. 새로고침 후 다시 시도해 주세요.'; end if;
  if old.archived_at is not null or exists(select 1 from public.group_participants where class_id=cid) or private.group_class_phase(old.status,old.starts_at,old.duration_minutes) in ('live','ended','cancelled') then raise exception '참가 이후 프로그램은 고정돼요. 새 수업으로 복제해 주세요.'; end if;
 end if;
 if not public.is_ntac_admin() and coach<>auth.uid() then raise exception '본인 담당 수업만 만들 수 있어요.'; end if;
 if coach is null or not exists(select 1 from public.profiles where id=coach and role in ('owner','admin','coach')) then raise exception '담당 코치를 선택해 주세요.'; end if;
 if payload ? 'class_type_id' and payload->>'class_type_id' is not null and not exists(select 1 from public.group_class_types where id=payload->>'class_type_id') then raise exception '수업 종류를 확인해 주세요.'; end if;
 perform private.group_validate_movements(payload->'movements');
 insert into public.group_classes(id,title,starts_at,duration_minutes,coach_id,description,movements,created_by,recording_version,class_type_id)
 values(cid,trim(payload->>'title'),(payload->>'starts_at')::timestamptz,(payload->>'duration_minutes')::integer,coach,coalesce(payload->>'description',''),payload->'movements',auth.uid(),case when payload->>'recording_version'='2' or exists(select 1 from jsonb_array_elements(payload->'movements') m where m->>'training_type'='strength') then 2 else 1 end,case when payload ? 'class_type_id' then payload->>'class_type_id' else old.class_type_id end)
 on conflict(id) do update set class_type_id=excluded.class_type_id,title=excluded.title,starts_at=excluded.starts_at,duration_minutes=excluded.duration_minutes,coach_id=excluded.coach_id,description=excluded.description,movements=excluded.movements,recording_version=greatest(group_classes.recording_version,excluded.recording_version),program_version=group_classes.program_version+1,revision=group_classes.revision+1,updated_at=now();
 insert into public.group_audit(class_id,actor_id,action) values(cid,auth.uid(),'save_program');
 return cid;
end $function$
;
CREATE OR REPLACE FUNCTION public.group_remove_program(kind text, target_id uuid, expected_revision integer DEFAULT NULL::integer)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare c public.group_classes; w public.group_weeks;
begin
 if auth.uid() is null then raise exception '로그인이 필요해요.'; end if;
 if kind='class' then
  if not private.group_manage(target_id) then raise exception '담당 수업만 삭제할 수 있어요.'; end if;
  select * into c from public.group_classes where id=target_id for update;
  if c.revision is distinct from expected_revision then raise exception '수업이 변경됐어요. 다시 불러와 주세요.'; end if;
  update public.group_classes set archived_at=now(),status=case when private.group_class_phase(status,starts_at,duration_minutes)='ended' then 'ended' else 'cancelled' end,revision=revision+1,updated_at=now() where id=target_id;
  update public.group_participants set status='cancelled',revision=revision+1,updated_at=now() where class_id=target_id and status='planned';
  insert into public.group_audit(class_id,actor_id,action,detail) values(target_id,auth.uid(),'archive_class',to_jsonb(c));
 elsif kind='template' then
  if not private.group_staff() or not exists(select 1 from public.group_templates where id=target_id and (created_by=auth.uid() or public.is_ntac_admin())) then raise exception '본인이 만든 템플릿만 삭제할 수 있어요.'; end if;
  update public.group_templates set archived_at=now() where id=target_id;
 elsif kind='week' then
  if not public.is_ntac_admin() then raise exception '관리자만 주간 프로그램을 삭제할 수 있어요.'; end if;
  -- Match publisher lock order.
  perform 1 from public.group_timetable where id for update;
  select * into w from public.group_weeks where id=target_id for update;
  if w.revision is distinct from expected_revision then raise exception '주간 프로그램이 변경됐어요. 다시 불러와 주세요.'; end if;
  update public.group_weeks set status='archived',revision=revision+1,updated_at=now() where id=target_id;
  for c in select * from public.group_classes where week_id=target_id and status in ('draft','published') and starts_at>now() and archived_at is null order by id for update loop
   update public.group_classes set archived_at=now(),status='cancelled',revision=revision+1,updated_at=now() where id=c.id;
   update public.group_participants set status='cancelled',revision=revision+1,updated_at=now() where class_id=c.id and status='planned';
  end loop;
  insert into public.group_audit(actor_id,action,detail) values(auth.uid(),'archive_week',jsonb_build_object('before',to_jsonb(w)));
 else raise exception '삭제할 프로그램 종류를 확인해 주세요.'; end if;
end $function$
;
CREATE OR REPLACE FUNCTION public.group_display(display_token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare t private.group_display_tokens; w public.group_walls; c public.group_classes; mid text; mid_index integer;
begin
 if length(coalesce(display_token,''))<>72 then raise exception 'TV 연결 링크를 확인해 주세요.'; end if;
 select * into t from private.group_display_tokens where token_hash=encode(sha256(convert_to(display_token,'UTF8')),'hex') and not revoked and expires_at>now();
 if not found then raise exception 'TV 연결이 해제됐거나 만료됐어요. 관리자에게 새 링크를 요청해 주세요.'; end if;
 select * into w from public.group_walls where id=t.wall_id;
 select * into c from public.group_classes where id=private.group_display_class();
 if c.id is not null and jsonb_array_length(c.movements)>0 then
  mid_index:=mod(floor(greatest(0,extract(epoch from (now()-c.starts_at)))/20)::bigint,jsonb_array_length(c.movements))::integer;
  mid:=c.movements->mid_index->>'id';
 end if;
 return jsonb_build_object('kind',t.kind,'wall',w.title,'updated_at',now(),'movement_id',mid,'movement_index',mid_index,'automatic',true,
 'class',case when c.id is null then null else jsonb_build_object('id',c.id,'title',c.title,'starts_at',c.starts_at,'status',private.group_class_phase(c.status,c.starts_at,c.duration_minutes),'duration_minutes',c.duration_minutes,'movements',c.movements,'program_version',c.program_version) end,
 'participants',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'name',g.nickname,'status',p.status,'difficulty',p.difficulty,'finalized',p.finalized,
 'recommendations',case when t.kind='recommendations' then (select jsonb_object_agg(k,jsonb_build_object('weight',v->'weight','source',v->'source','sets',(select jsonb_agg(jsonb_build_object('weight',ss->'weight','reps',ss->'reps','rir',ss->'rir','source',ss->'source')) from jsonb_array_elements(coalesce(v->'sets','[]')) ss))) from jsonb_each(p.recommendations) x(k,v)) else null end,
 'results',case when t.kind='results' then p.results else null end) order by p.joined_at)
 from public.group_participants p join public.group_members g on g.user_id=p.user_id where p.class_id=c.id and p.status in ('active','completed') and g.show_on_tv and length(trim(g.nickname))>0),'[]'));
end $function$
;

notify pgrst,'reload schema';
