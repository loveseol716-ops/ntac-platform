import assert from 'node:assert/strict';
import { needsMemberName, normalizeMemberName } from '../web/src/management/memberIdentity.js';
import { deleteMemberHandler } from '../supabase/functions/ntac-admin-delete-member/handler.js';
for (const value of [undefined,null,'',' ','이름 없음',' 이름  없음 ','회원','UNKNOWN','123','A','a'.repeat(81)]) assert(needsMemberName(value),String(value));
for (const value of ['설재현','윤 다원','John Smith','李小龍']) assert(!needsMemberName(value),value);
assert.equal(normalizeMemberName('  설   재현  '),'설 재현');
const actorId='10000000-0000-4000-8000-000000000001',targetId='10000000-0000-4000-8000-000000000002';
let role='member',deleted=false,invalid=false,disableFailure=false,deleteFailure=false;
let calls=[];
const handler=deleteMemberHandler((url,key,opts)=>{
 const server=key==='server-secret';
 if (server) assert.equal(opts.global,undefined,'Do not inherit caller token on service client');
 else assert.equal(opts.global.headers.Authorization,'Bearer verified');
 return {
  auth:{getUser:async()=>invalid?{error:new Error('invalid')}:{data:{user:{id:actorId}}},admin:{deleteUser:async(id,soft)=>{assert(server);assert.equal(id,targetId);assert.equal(soft,true);calls.push('auth-delete');return deleteFailure?{error:new Error('network')}:{data:{}};}}},
  from:()=>({select:()=>({eq:()=>({single:async()=>({data:{role,deleted_at:deleted?'2026-11-09':null}})})})}),
  rpc:async(name,args)=>{assert(!server);assert.equal(name,'ntac_disable_member_account');assert.equal(args.target_id,targetId);assert.equal(args.confirm_email,'member@example.invalid');calls.push('disable');return disableFailure?{error:new Error('일반 회원 계정만 삭제할 수 있어요.')}:{data:null};}
 };
},key=>({SUPABASE_URL:'https://test.invalid',SUPABASE_ANON_KEY:'public',SUPABASE_SERVICE_ROLE_KEY:'server-secret'})[key]);
const body={target_id:targetId,confirm_email:'member@example.invalid'};
const req=(value=body)=>new Request('https://test.invalid',{method:'POST',headers:{Authorization:'Bearer verified','Content-Type':'application/json'},body:JSON.stringify(value)});
assert.equal((await handler(new Request('https://test.invalid',{method:'POST'}))).status,401);
for(const r of ['member','coach']) {role=r;assert.equal((await handler(req())).status,403);}
role='admin';deleted=true;assert.equal((await handler(req())).status,403);deleted=false;
invalid=true;assert.equal((await handler(req())).status,401);invalid=false;
for(const value of [null,{}, {...body,target_id:'bad'}, {...body,confirm_email:''}]) assert.equal((await handler(req(value))).status,400);
assert.equal((await handler(req({...body,target_id:actorId}))).status,403);
assert.deepEqual(calls,[]);
disableFailure=true;assert.equal((await handler(req())).status,400);assert.deepEqual(calls,['disable']);disableFailure=false;calls=[];
deleteFailure=true;const partial=await handler(req());assert.equal(partial.status,502);assert.equal((await partial.json()).access_blocked,true);assert.deepEqual(calls,['disable','auth-delete']);deleteFailure=false;
for(const r of ['owner','admin']) {role=r;calls=[];const result=await handler(req());assert.equal(result.status,200);assert.deepEqual(await result.json(),{success:true});assert.deepEqual(calls,['disable','auth-delete']);}
assert.equal((await handler(new Request('https://test.invalid',{method:'OPTIONS'}))).status,204);
console.log('PASS: name validation; unauthenticated, expired, member, coach, deleted admin, self and invalid confirmations denied; fail-closed Auth deletion and safe retry');
