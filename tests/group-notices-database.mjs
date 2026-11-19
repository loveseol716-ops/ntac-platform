import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
const {PGlite}=await import(pathToFileURL(`${process.env.NTAC_TEST_MODULES}/@electric-sql/pglite/dist/index.js`));
const db=new PGlite();
try{
 await db.exec(`create role anon;create role authenticated;create schema auth;create schema private;
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 create table public.profiles(id uuid primary key,role text);
 create function public.is_ntac_admin() returns boolean language sql stable security definer set search_path='' as $$select exists(select 1 from public.profiles where id=auth.uid() and role in ('owner','admin'))$$;
 create function private.group_staff() returns boolean language sql stable security definer set search_path='' as $$select auth.uid() is not null and exists(select 1 from public.profiles where id=auth.uid() and role in ('owner','admin','coach'))$$;
 create table public.group_members(user_id uuid primary key references public.profiles(id),active boolean not null);
 alter table public.group_members enable row level security;
 create policy member_read on public.group_members for select to authenticated using(user_id=auth.uid() or private.group_staff());
 grant usage on schema public,private,auth to authenticated,anon;grant select on public.group_members to authenticated;
 insert into public.profiles values('10000000-0000-4000-8000-000000000001','admin'),('10000000-0000-4000-8000-000000000002','member'),('10000000-0000-4000-8000-000000000003','member'),('10000000-0000-4000-8000-000000000004','coach');`);
 await db.exec(fs.readFileSync('supabase/migrations/20261119045419_group_notices.sql','utf8'));
 const result=await db.exec(fs.readFileSync('tests/group-notices-smoke.sql','utf8'));console.log(result.at(-1).rows);
}catch(e){console.error(e.message,e.where||'');process.exitCode=1;}finally{await db.close();}
