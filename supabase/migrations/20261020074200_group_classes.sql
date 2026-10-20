-- Additive group training. No PT sessions, pass ledgers or NTAC completions are written.
create table public.group_members (
 user_id uuid primary key references public.profiles(id), active boolean not null default true,
 nickname text not null default '' check(length(nickname)<=30), show_on_tv boolean not null default false,
 updated_at timestamptz not null default now()
);
create table public.group_exercises (
 id text primary key check(length(id) between 1 and 80), name text not null check(length(name) between 1 and 100)
);
insert into public.group_exercises(id,name) values
 ('back_squat','백 스쿼트'),('front_squat','프런트 스쿼트'),('deadlift','데드리프트'),
 ('bench_press','벤치 프레스'),('overhead_press','오버헤드 프레스'),('db_press','덤벨 프레스'),
 ('goblet_squat','고블릿 스쿼트'),('kettlebell_swing','케틀벨 스윙'),('running','러닝'),
 ('rowing','로잉'),('bike','바이크'),('burpee','버피'),('pull_up','풀업');
create table public.group_templates (
 id uuid primary key default gen_random_uuid(), title text not null, description text not null default '',
 movements jsonb not null default '[]', created_by uuid not null references public.profiles(id), updated_at timestamptz not null default now()
);
create table public.group_classes (
 id uuid primary key default gen_random_uuid(), title text not null check(length(trim(title)) between 1 and 120),
 starts_at timestamptz not null, duration_minutes integer not null default 50 check(duration_minutes between 10 and 240),
 coach_id uuid not null references public.profiles(id), description text not null default '' check(length(description)<=10000),
 movements jsonb not null default '[]' check(jsonb_typeof(movements)='array'), program_version integer not null default 1,
 status text not null default 'draft' check(status in ('draft','published','open','live','ended','cancelled')),
 ended_at timestamptz, created_by uuid not null references public.profiles(id), updated_at timestamptz not null default now(),
 revision integer not null default 1
);
create index group_classes_start_idx on public.group_classes(starts_at);
create index group_classes_coach_idx on public.group_classes(coach_id,starts_at);
create table public.group_participants (
 id uuid primary key default gen_random_uuid(), class_id uuid not null references public.group_classes(id),
 user_id uuid not null references public.profiles(id), status text not null default 'active' check(status in ('active','completed','left','cancelled')),
 difficulty text not null default 'standard' check(difficulty in ('foundation','standard','advanced')),
 recommendations jsonb not null default '{}', results jsonb not null default '{}',
 note text not null default '' check(length(note)<=1000), finalized boolean not null default false,
 exception_access boolean not null default false, joined_at timestamptz not null default now(), completed_at timestamptz,
 revision integer not null default 1, updated_at timestamptz not null default now(), unique(class_id,user_id)
);
create index group_participants_user_idx on public.group_participants(user_id,joined_at desc);
create table public.group_baselines (
 user_id uuid not null references public.profiles(id), exercise_id text not null references public.group_exercises(id),
 target_reps integer not null check(target_reps between 1 and 1000), unit text not null check(unit in ('kg','lb')),
 load_basis text not null check(load_basis in ('total','each')), difficulty text not null check(difficulty in ('foundation','standard','advanced')),
 weight numeric not null check(weight between 0 and 2000), reason text not null check(length(trim(reason)) between 1 and 300),
 updated_by uuid not null references public.profiles(id), updated_at timestamptz not null default now(),
 primary key(user_id,exercise_id,target_reps,unit,load_basis,difficulty)
);
create table public.group_audit (
 id bigint generated always as identity primary key, class_id uuid references public.group_classes(id),
 participant_id uuid references public.group_participants(id), actor_id uuid references public.profiles(id),
 action text not null, detail jsonb not null default '{}', created_at timestamptz not null default now()
);
create index group_audit_class_idx on public.group_audit(class_id,created_at desc);
create table public.group_walls (
 id uuid primary key default gen_random_uuid(), title text not null, class_id uuid references public.group_classes(id),
 movement_id text, created_by uuid not null references public.profiles(id), updated_at timestamptz not null default now()
);
create index group_walls_class_idx on public.group_walls(class_id);
create index group_walls_creator_idx on public.group_walls(created_by);
create index group_templates_creator_idx on public.group_templates(created_by);
create index group_classes_creator_idx on public.group_classes(created_by);
create index group_baselines_exercise_idx on public.group_baselines(exercise_id);
create index group_baselines_updater_idx on public.group_baselines(updated_by);
create index group_audit_participant_idx on public.group_audit(participant_id);
create index group_audit_actor_idx on public.group_audit(actor_id);
create table private.group_display_tokens (
 token_hash text primary key, wall_id uuid not null references public.group_walls(id),
 kind text not null check(kind in ('recommendations','results')), expires_at timestamptz not null, revoked boolean not null default false
);
create index group_display_tokens_wall_idx on private.group_display_tokens(wall_id);
revoke all on private.group_display_tokens from public,anon,authenticated;
alter table private.group_display_tokens enable row level security;

-- Only guarded RPCs write these tables. Read policies retain member history on deactivation.
create function private.group_staff() returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(select 1 from public.profiles where id=auth.uid() and role in ('owner','admin','coach'));
$$;
create function private.group_manage(cid uuid) returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and (public.is_ntac_admin() or exists(select 1 from public.group_classes c join public.profiles p on p.id=c.coach_id where c.id=cid and c.coach_id=auth.uid() and p.role in ('owner','admin','coach')));
$$;
create function private.group_access(cid uuid) returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and (private.group_manage(cid) or exists(select 1 from public.group_participants where class_id=cid and user_id=auth.uid()) or (exists(select 1 from public.group_members where user_id=auth.uid() and active) and exists(select 1 from public.group_classes where id=cid and status<>'draft')));
$$;
revoke all on function private.group_staff(), private.group_manage(uuid), private.group_access(uuid) from public,anon,authenticated;
grant execute on function private.group_staff(), private.group_manage(uuid), private.group_access(uuid) to authenticated;
DO $$ declare t text; begin
 foreach t in array array['group_members','group_exercises','group_templates','group_classes','group_participants','group_baselines','group_audit','group_walls'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from public,anon,authenticated',t);
  execute format('grant select on public.%I to authenticated',t);
 end loop;
end $$;
revoke all on sequence public.group_audit_id_seq from public,anon,authenticated;
create policy group_member_read on public.group_members for select to authenticated using(user_id=(select auth.uid()) or (select public.is_ntac_admin()));
create policy group_exercise_read on public.group_exercises for select to authenticated using(true);
create policy group_template_read on public.group_templates for select to authenticated using((select private.group_staff()));
create policy group_class_read on public.group_classes for select to authenticated using(private.group_access(id));
create policy group_participant_read on public.group_participants for select to authenticated using(user_id=(select auth.uid()) or private.group_manage(class_id));
create policy group_baseline_read on public.group_baselines for select to authenticated using(user_id=(select auth.uid()) or (select public.is_ntac_admin()));
create policy group_audit_read on public.group_audit for select to authenticated using(private.group_manage(class_id));
create policy group_wall_read on public.group_walls for select to authenticated using((select public.is_ntac_admin()) or created_by=(select auth.uid()));

create function private.group_validate_movements(items jsonb) returns void language plpgsql security invoker set search_path='' as $$
declare m jsonb; ids text[] := '{}';
begin
 if items is null or jsonb_typeof(items)<>'array' or jsonb_array_length(items)>20 then raise exception '핵심 운동은 최대 20개까지 등록할 수 있어요.'; end if;
 for m in select value from jsonb_array_elements(items) loop
  if length(coalesce(m->>'id','')) not between 1 and 80 or m->>'id' in ('__proto__','constructor','prototype') or m->>'id'=any(ids) or not exists(select 1 from public.group_exercises where id=m->>'exercise_id') then raise exception '운동 ID와 표준 종목을 확인해 주세요.'; end if;
  ids:=array_append(ids,m->>'id');
  if coalesce(m->>'kind','') not in ('weight','time','rounds','distance','calories','participation') or coalesce(m->>'unit','') not in ('kg','lb','s','m','cal','reps') or coalesce(m->>'load_basis','') not in ('total','each','bodyweight') then raise exception '운동 기록 형식을 확인해 주세요.'; end if;
  if m->>'kind'='weight' and ((m->>'unit') not in ('kg','lb') or (m->>'load_basis') not in ('total','each') or coalesce((m->>'target_reps')::integer,0) not between 1 and 1000) then raise exception '중량 운동은 단위·중량 기준·목표 횟수를 입력해 주세요.'; end if;
  if (m->>'kind'='time' and m->>'unit'<>'s') or (m->>'kind'='distance' and m->>'unit'<>'m') or (m->>'kind'='calories' and m->>'unit'<>'cal') or (m->>'kind' in ('rounds','participation') and m->>'unit'<>'reps') then raise exception '기록 형식과 단위를 맞춰 주세요.'; end if;
  if length(coalesce(m->>'label',''))>100 then raise exception '운동 이름이 너무 길어요.'; end if;
 end loop;
end $$;
revoke all on function private.group_validate_movements(jsonb) from public,anon,authenticated;

create function public.group_bootstrap() returns jsonb language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('member',(select to_jsonb(m) from public.group_members m where user_id=auth.uid()),'has_history',exists(select 1 from public.group_participants where user_id=auth.uid()));
$$;
create function public.group_set_member(target_id uuid, enabled boolean) returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not public.is_ntac_admin() then raise exception '그룹 이용 권한은 관리자만 변경할 수 있어요.'; end if;
 insert into public.group_members(user_id,active) values(target_id,enabled) on conflict(user_id) do update set active=excluded.active,updated_at=now();
 insert into public.group_audit(actor_id,action,detail) values(auth.uid(),'membership',jsonb_build_object('user_id',target_id,'active',enabled));
end $$;
create function public.group_set_privacy(display_name text, visible boolean) returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception '로그인이 필요해요.'; end if;
 if length(trim(display_name))>30 or (visible and length(trim(display_name))=0) then raise exception 'TV에 표시할 별명을 1~30자로 입력해 주세요.'; end if;
 update public.group_members set nickname=trim(display_name),show_on_tv=visible,updated_at=now() where user_id=auth.uid();
 if not found then raise exception '그룹 참가 정보를 먼저 등록해 주세요.'; end if;
end $$;
create function public.group_directory(cid uuid default null) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null or not (public.is_ntac_admin() or private.group_manage(cid)) then raise exception '담당 수업에서만 회원을 조회할 수 있어요.'; end if;
 return coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'name',p.full_name,'email',case when public.is_ntac_admin() then p.email else null end,'active',coalesce(g.active,false),'role',p.role) order by p.full_name) from public.profiles p left join public.group_members g on g.user_id=p.id where public.is_ntac_admin() or g.active or exists(select 1 from public.group_participants where class_id=cid and user_id=p.id)), '[]');
end $$;
create function public.group_save_class(payload jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare cid uuid := coalesce(nullif(payload->>'id','')::uuid,gen_random_uuid()); old public.group_classes; coach uuid := (payload->>'coach_id')::uuid;
begin
 if not private.group_staff() then raise exception '코치 권한이 필요해요.'; end if;
 select * into old from public.group_classes where id=cid for update;
 if found then
  if not private.group_manage(cid) then raise exception '담당 수업만 수정할 수 있어요.'; end if;
  if old.revision<>coalesce((payload->>'revision')::integer,0) then raise exception '수업이 변경됐어요. 새로고침 후 다시 시도해 주세요.'; end if;
  if exists(select 1 from public.group_participants where class_id=cid) or old.status in ('live','ended','cancelled') then raise exception '참가 이후 프로그램은 고정돼요. 새 수업으로 복제해 주세요.'; end if;
 end if;
 if not public.is_ntac_admin() and coach<>auth.uid() then raise exception '본인 담당 수업만 만들 수 있어요.'; end if;
 if coach is null or not exists(select 1 from public.profiles where id=coach and role in ('owner','admin','coach')) then raise exception '담당 코치를 선택해 주세요.'; end if;
 perform private.group_validate_movements(payload->'movements');
 insert into public.group_classes(id,title,starts_at,duration_minutes,coach_id,description,movements,created_by)
 values(cid,trim(payload->>'title'),(payload->>'starts_at')::timestamptz,(payload->>'duration_minutes')::integer,coach,coalesce(payload->>'description',''),payload->'movements',auth.uid())
 on conflict(id) do update set title=excluded.title,starts_at=excluded.starts_at,duration_minutes=excluded.duration_minutes,coach_id=excluded.coach_id,description=excluded.description,movements=excluded.movements,program_version=group_classes.program_version+1,revision=group_classes.revision+1,updated_at=now();
 insert into public.group_audit(class_id,actor_id,action) values(cid,auth.uid(),'save_program');
 return cid;
end $$;
create function public.group_set_class_status(cid uuid, next_status text, expected_revision integer) returns void language plpgsql security definer set search_path='' as $$
declare c public.group_classes;
begin
 if not private.group_manage(cid) then raise exception '담당 수업만 운영할 수 있어요.'; end if;
 select * into c from public.group_classes where id=cid for update;
 if c.revision<>expected_revision then raise exception '수업 상태가 변경됐어요. 새로고침해 주세요.'; end if;
 if c.status=next_status then return; end if;
 if not ((c.status='draft' and next_status in ('published','cancelled')) or (c.status='published' and next_status in ('draft','open','cancelled')) or (c.status='open' and next_status in ('live','ended','cancelled')) or (c.status='live' and next_status in ('ended','cancelled'))) then raise exception '허용되지 않은 수업 상태 변경이에요.'; end if;
 if next_status in ('open','live') and (c.starts_at at time zone 'Asia/Seoul')::date<>(now() at time zone 'Asia/Seoul')::date then raise exception '참가 접수와 수업 시작은 당일에만 가능해요.'; end if;
 update public.group_classes set status=next_status,ended_at=case when next_status='ended' then now() else ended_at end,revision=revision+1,updated_at=now() where id=cid;
 insert into public.group_audit(class_id,actor_id,action,detail) values(cid,auth.uid(),'class_status',jsonb_build_object('from',c.status,'to',next_status));
end $$;
create function public.group_save_template(payload jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare tid uuid := gen_random_uuid();
begin
 if not private.group_staff() then raise exception '코치 권한이 필요해요.'; end if;
 perform private.group_validate_movements(payload->'movements');
 if length(trim(coalesce(payload->>'title',''))) not between 1 and 120 then raise exception '템플릿 이름을 입력해 주세요.'; end if;
 insert into public.group_templates(id,title,description,movements,created_by) values(tid,trim(payload->>'title'),coalesce(payload->>'description',''),payload->'movements',auth.uid());return tid;
end $$;
create function public.group_add_exercise(exercise_name text) returns text language plpgsql security definer set search_path='' as $$
declare eid text := 'custom_'||gen_random_uuid()::text;
begin
 if not public.is_ntac_admin() then raise exception '종목 추가는 관리자만 가능해요.'; end if;
 insert into public.group_exercises(id,name) values(eid,trim(exercise_name)); return eid;
end $$;

-- Snapshot recommendations at join. Matching conditions are deliberately strict.
create function private.group_recommend(cid uuid, uid uuid, level text) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare m jsonb; c public.group_classes; answer jsonb := '{}'; w numeric; source text; source_id uuid;
begin
 select * into c from public.group_classes where id=cid;
 for m in select value from jsonb_array_elements(c.movements) loop
  w:=null; source:='coach_required'; source_id:=null;
  if m->>'kind'='weight' then
   select (r.value->>'weight')::numeric,p.id into w,source_id
   from public.group_participants p join public.group_classes pc on pc.id=p.class_id
   cross join lateral jsonb_array_elements(pc.movements) pm
   cross join lateral jsonb_each(p.results) r
   where p.user_id=uid and p.class_id<>cid and p.status='completed' and p.finalized and p.difficulty=level
    and pc.status<>'cancelled' and pc.starts_at<c.starts_at and pc.starts_at>c.starts_at-interval '90 days'
    and r.key=pm->>'id' and pm->>'exercise_id'=m->>'exercise_id' and pm->>'kind'='weight'
    and pm->>'unit'=m->>'unit' and pm->>'load_basis'=m->>'load_basis' and pm->>'target_reps'=m->>'target_reps'
    and (r.value->>'reps')::numeric>=(m->>'target_reps')::numeric and (r.value->>'weight') is not null
    and coalesce(r.value->>'dnf','false')='false'
   order by pc.starts_at desc limit 1;
   if w is not null then source:='recent_result'; else
    select b.weight into w from public.group_baselines b where b.user_id=uid and b.exercise_id=m->>'exercise_id' and b.target_reps=(m->>'target_reps')::integer and b.unit=m->>'unit' and b.load_basis=m->>'load_basis' and b.difficulty=level;
    if w is not null then source:='coach_baseline'; end if;
   end if;
  else source:='program'; end if;
  answer:=answer||jsonb_build_object(m->>'id',jsonb_build_object('weight',w,'source',source,'source_id',source_id,'program_version',c.program_version,'rule_version','same-condition-v1','created_at',now()));
 end loop;
 return answer;
end $$;
revoke all on function private.group_recommend(uuid,uuid,text) from public,anon,authenticated;
create function public.group_join(cid uuid, user_ids uuid[] default null, allow_exception boolean default false) returns jsonb language plpgsql security definer set search_path='' as $$
declare c public.group_classes; uid uuid; p public.group_participants; ids uuid[]; added integer:=0; existing integer:=0; eligible boolean;
begin
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
create function public.group_detail(cid uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not private.group_access(cid) then raise exception '이 수업을 볼 권한이 없어요.'; end if;
 return jsonb_build_object('class',(select to_jsonb(c) from public.group_classes c where id=cid),'can_manage',private.group_manage(cid),
 'participants',coalesce((select jsonb_agg(to_jsonb(p)||jsonb_build_object('name',pr.full_name,'nickname',g.nickname,'show_on_tv',g.show_on_tv) order by p.joined_at) from public.group_participants p join public.profiles pr on pr.id=p.user_id left join public.group_members g on g.user_id=p.user_id where p.class_id=cid and (p.user_id=auth.uid() or private.group_manage(cid))),'[]'));
end $$;
create function public.group_save_participant(pid uuid, expected_revision integer, payload jsonb) returns void language plpgsql security definer set search_path='' as $$
declare p public.group_participants; c public.group_classes; manager boolean; newstate text; newlevel text; r jsonb; m jsonb; k text; v text; clean jsonb := '{}'; rec jsonb; reason text;
begin
 select cl.* into c from public.group_classes cl join public.group_participants pp on pp.class_id=cl.id where pp.id=pid for update of cl;
 select * into p from public.group_participants where id=pid for update;
 if not found then raise exception '참가 정보를 찾을 수 없어요.'; end if;
 manager:=private.group_manage(p.class_id);
 if auth.uid() is null or (not manager and p.user_id<>auth.uid()) then raise exception '본인 또는 담당 코치만 기록을 저장할 수 있어요.'; end if;
 if p.revision<>expected_revision then raise exception '다른 기기에서 기록이 바뀌었어요. 새로고침 후 다시 입력해 주세요.'; end if;
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
create function public.group_set_baseline(payload jsonb) returns void language plpgsql security definer set search_path='' as $$
begin
 if not public.is_ntac_admin() then raise exception '기준 중량은 관리자만 설정할 수 있어요.'; end if;
 insert into public.group_baselines(user_id,exercise_id,target_reps,unit,load_basis,difficulty,weight,reason,updated_by)
 values((payload->>'user_id')::uuid,payload->>'exercise_id',(payload->>'target_reps')::integer,payload->>'unit',payload->>'load_basis',payload->>'difficulty',(payload->>'weight')::numeric,payload->>'reason',auth.uid())
 on conflict(user_id,exercise_id,target_reps,unit,load_basis,difficulty) do update set weight=excluded.weight,reason=excluded.reason,updated_by=auth.uid(),updated_at=now();
 insert into public.group_audit(actor_id,action,detail) values(auth.uid(),'baseline',payload);
end $$;

-- TV clients receive only a sanitized projection, never an administrator session.
create function public.group_create_wall(wall_title text) returns jsonb language plpgsql security definer set search_path='' as $$
declare wid uuid; a text:=gen_random_uuid()::text||gen_random_uuid()::text; b text:=gen_random_uuid()::text||gen_random_uuid()::text;
begin
 if not public.is_ntac_admin() then raise exception 'TV 연결은 관리자만 설정할 수 있어요.'; end if;
 if length(trim(wall_title)) not between 1 and 60 then raise exception 'TV 이름을 입력해 주세요.'; end if;
 insert into public.group_walls(title,created_by) values(trim(wall_title),auth.uid()) returning id into wid;
 insert into private.group_display_tokens(token_hash,wall_id,kind,expires_at) values
 (encode(sha256(convert_to(a,'UTF8')),'hex'),wid,'recommendations',now()+interval '90 days'),
 (encode(sha256(convert_to(b,'UTF8')),'hex'),wid,'results',now()+interval '90 days');
 return jsonb_build_object('id',wid,'recommendations',a,'results',b);
end $$;
create function public.group_control_wall(wid uuid, cid uuid, mid text default null, revoke_link boolean default false) returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not (public.is_ntac_admin() or (private.group_manage(cid) and exists(select 1 from public.group_walls where id=wid and created_by=auth.uid()))) then raise exception 'TV 제어 권한이 없어요.'; end if;
 if cid is not null and not private.group_manage(cid) then raise exception '담당 수업만 송출할 수 있어요.'; end if;
 if mid is not null and not exists(select 1 from public.group_classes c cross join lateral jsonb_array_elements(c.movements) m where c.id=cid and m->>'id'=mid) then raise exception '수업에 있는 운동을 선택해 주세요.'; end if;
 update public.group_walls set class_id=cid,movement_id=mid,updated_at=now() where id=wid;
 if revoke_link then update private.group_display_tokens set revoked=true where wall_id=wid; end if;
end $$;
create function public.group_display(display_token text) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare t private.group_display_tokens; w public.group_walls; c public.group_classes;
begin
 if length(coalesce(display_token,''))<>72 then raise exception 'TV 연결 링크를 확인해 주세요.'; end if;
 select * into t from private.group_display_tokens where token_hash=encode(sha256(convert_to(display_token,'UTF8')),'hex') and not revoked and expires_at>now();
 if not found then raise exception 'TV 연결이 해제됐거나 만료됐어요. 관리자에게 새 링크를 요청해 주세요.'; end if;
 select * into w from public.group_walls where id=t.wall_id;
 select * into c from public.group_classes where id=w.class_id and status in ('open','live','ended');
 return jsonb_build_object('kind',t.kind,'wall',w.title,'updated_at',now(),'movement_id',w.movement_id,
 'class',case when c.id is null then null else jsonb_build_object('id',c.id,'title',c.title,'starts_at',c.starts_at,'status',c.status,'movements',c.movements,'program_version',c.program_version) end,
 'participants',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'name',g.nickname,'status',p.status,'difficulty',p.difficulty,'finalized',p.finalized,
 'recommendations',case when t.kind='recommendations' then (select jsonb_object_agg(k,jsonb_build_object('weight',v->'weight','source',v->'source')) from jsonb_each(p.recommendations) x(k,v)) else null end,
 'results',case when t.kind='results' then p.results else null end) order by p.joined_at)
 from public.group_participants p join public.group_members g on g.user_id=p.user_id where p.class_id=c.id and p.status in ('active','completed') and g.show_on_tv and length(trim(g.nickname))>0),'[]'));
end $$;

-- New RPC separates NTAC/PT coach assignments; legacy RPC retained for cached clients.
create function public.set_member_services_v2(target_id uuid, enable_ntac boolean, enable_pt boolean, ntac_coach_id uuid default null, pt_coach_id uuid default null) returns void language plpgsql security invoker set search_path='' as $$
begin
 if auth.uid() is null or not public.is_ntac_admin() then raise exception '관리자 권한이 필요해요.'; end if;
 if pt_coach_id is not null and not exists(select 1 from public.profiles where id=pt_coach_id and role in ('owner','admin','coach')) then raise exception 'PT 코치를 확인해 주세요.'; end if;
 perform public.set_member_services(target_id,enable_ntac,enable_pt,ntac_coach_id);
 update public.pt_members set coach_id=pt_coach_id where profile_id=target_id;
end $$;
-- Explicitly remove implicit PUBLIC execute grants on every new API function.
DO $$ declare f record; begin
 for f in select p.oid::regprocedure as signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and (p.proname like 'group_%' or p.proname='set_member_services_v2') loop
  execute format('revoke all on function %s from public,anon,authenticated',f.signature);
  execute format('grant execute on function %s to authenticated',f.signature);
 end loop;
end $$;
grant execute on function public.group_display(text) to anon;
notify pgrst,'reload schema';
