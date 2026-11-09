import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
const { PGlite } = await import(pathToFileURL(`${process.env.NTAC_TEST_MODULES}/@electric-sql/pglite/dist/index.js`));
const db = new PGlite();
try {
 await db.exec(`create role anon; create role authenticated; create role service_role; create role authenticator;
 create schema auth; create schema private;
 create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
 grant usage on schema public,auth,private to authenticated;
 create table public.profiles(id uuid primary key,full_name text,email text,role text,phone text,ntac_enabled boolean default false,coach_care boolean default false,membership_status text default 'active');
 create table public.group_members(user_id uuid primary key references public.profiles(id),active boolean,updated_at timestamptz);
 create table public.pt_members(profile_id uuid primary key references public.profiles(id),active boolean);
 create table public.group_participants(user_id uuid references public.profiles(id));
 grant select,update on profiles to authenticated; grant select on group_members,pt_members,group_participants to authenticated;
 insert into public.profiles values('10000000-0000-4000-8000-000000000001','관리자','owner@example.invalid','owner','01012345678',true,true,'active'),('10000000-0000-4000-8000-000000000002','','member@example.invalid','member','01023456789',true,true,'active');
 insert into public.pt_members values('10000000-0000-4000-8000-000000000002',true);
 insert into public.group_members values('10000000-0000-4000-8000-000000000002',true,now());
 insert into public.group_participants values('10000000-0000-4000-8000-000000000002');`);
 await db.exec(fs.readFileSync('supabase/migrations/20261109140608_member_identity_account_deletion.sql','utf8'));
 await db.exec(`select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000002',false);set role authenticated;
 do $$ begin
 perform set_config('request.path','/profiles',true);perform private.ntac_check_account_request();
 perform set_config('request.path','/rpc/ntac_set_my_name',true);perform private.ntac_check_account_request();
 perform set_config('request.path','/rpc/group_bootstrap',true);
 begin perform private.ntac_check_account_request();raise exception 'Unnamed member reached services';exception when sqlstate 'PT428' then null;end;
 end $$;reset role;`);
 await db.exec(fs.readFileSync('tests/member-identity-production-smoke.sql','utf8'));
 console.log('PASS: required names, validation, admin/self/member boundaries, deletion confirmation, disabled services, retained history, old JWT denial and registered request hook');
} finally { await db.close(); }
