-- Notices are scoped to existing group-service access; NTAC/PT alone is insufficient.
create table public.group_notices (
 id uuid primary key default gen_random_uuid(),
 title text not null check(length(trim(title)) between 1 and 120),
 body text not null check(length(trim(body)) between 1 and 10000),
 link_url text check(link_url is null or (length(link_url)<=2000 and link_url ~* '^https?://[^[:space:]]+$')),
 pinned boolean not null default false,
 is_published boolean not null default true,
 revision integer not null default 1 check(revision>0),
 created_by uuid not null references public.profiles(id),
 updated_by uuid not null references public.profiles(id),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 deleted_at timestamptz
);
create index group_notices_feed_idx on public.group_notices(pinned desc,created_at desc,id desc) where deleted_at is null and is_published;
alter table public.group_notices enable row level security;
revoke all on public.group_notices from public,anon,authenticated;
grant select on public.group_notices to authenticated;
create policy group_notices_read on public.group_notices for select to authenticated using (
 deleted_at is null and ( (select public.is_ntac_admin()) or (is_published and (
  (select private.group_staff()) or exists(select 1 from public.group_members m where m.user_id=(select auth.uid()) and m.active)
 )))
);

create function private.group_save_notice(payload jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare nid uuid:=coalesce(nullif(payload->>'id','')::uuid,gen_random_uuid()); old public.group_notices; new_title text; new_body text; new_link text; new_pinned boolean; published boolean;
begin
 if auth.uid() is null or not public.is_ntac_admin() then raise exception '공지는 관리자만 작성할 수 있어요.';end if;
 if jsonb_typeof(payload) is distinct from 'object' or jsonb_typeof(payload->'title') is distinct from 'string' or jsonb_typeof(payload->'body') is distinct from 'string' then raise exception '제목과 내용을 입력해 주세요.';end if;
 new_title:=trim(payload->>'title');new_body:=trim(payload->>'body');new_link:=nullif(trim(coalesce(payload->>'link_url','')),'');
 if length(new_title) not between 1 and 120 or length(new_body) not between 1 and 10000 then raise exception '제목은 120자, 내용은 10,000자 이내로 입력해 주세요.';end if;
 if payload ? 'link_url' and jsonb_typeof(payload->'link_url') not in ('string','null') then raise exception '연결 링크를 확인해 주세요.';end if;
 if new_link is not null and (length(new_link)>2000 or new_link !~* '^https?://[^[:space:]]+$') then raise exception '연결 링크는 http:// 또는 https://로 입력해 주세요.';end if;
 if (payload ? 'pinned' and jsonb_typeof(payload->'pinned') is distinct from 'boolean') or (payload ? 'is_published' and jsonb_typeof(payload->'is_published') is distinct from 'boolean') then raise exception '공개·상단 고정 설정을 확인해 주세요.';end if;
 select * into old from public.group_notices where id=nid for update;
 if found then
  if old.deleted_at is not null then raise exception '삭제된 공지예요.';end if;
  if old.revision is distinct from (payload->>'revision')::integer then raise exception '공지가 변경됐어요. 새로고침 후 다시 수정해 주세요.';end if;
 end if;
 new_pinned:=coalesce((payload->>'pinned')::boolean,old.pinned,false);published:=coalesce((payload->>'is_published')::boolean,old.is_published,true);
 if old.id is null then
  insert into public.group_notices(id,title,body,link_url,pinned,is_published,created_by,updated_by) values(nid,new_title,new_body,new_link,new_pinned,published,auth.uid(),auth.uid());
 else
  update public.group_notices set title=new_title,body=new_body,link_url=new_link,pinned=new_pinned,is_published=published,revision=revision+1,updated_by=auth.uid(),updated_at=now() where id=nid;
 end if;
 return nid;
end $$;
create function public.group_save_notice(payload jsonb) returns uuid
language sql security invoker set search_path='' as $$ select private.group_save_notice(payload); $$;

create function private.group_delete_notice(notice_id uuid,expected_revision integer) returns void
language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not public.is_ntac_admin() then raise exception '공지는 관리자만 삭제할 수 있어요.';end if;
 update public.group_notices set deleted_at=now(),updated_at=now(),updated_by=auth.uid(),revision=revision+1 where id=notice_id and revision=expected_revision and deleted_at is null;
 if not found then raise exception '이미 삭제되었거나 변경된 공지예요. 새로고침해 주세요.';end if;
end $$;
create function public.group_delete_notice(notice_id uuid,expected_revision integer) returns void
language sql security invoker set search_path='' as $$ select private.group_delete_notice(notice_id,expected_revision); $$;
revoke all on function private.group_save_notice(jsonb),public.group_save_notice(jsonb),private.group_delete_notice(uuid,integer),public.group_delete_notice(uuid,integer) from public,anon,authenticated;
grant execute on function private.group_save_notice(jsonb),public.group_save_notice(jsonb),private.group_delete_notice(uuid,integer),public.group_delete_notice(uuid,integer) to authenticated;
notify pgrst,'reload schema';
