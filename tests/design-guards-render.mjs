import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(new URL('../web/package.json',import.meta.url));
const React=require('react'),{renderToStaticMarkup}=require('react-dom/server');
const {createServer}=await import(require.resolve('vite'));
const server=await createServer({root:new URL('../web',import.meta.url).pathname,server:{middlewareMode:true},appType:'custom'});
try{
 const {designRule,designIssues,defaultDesignMovement,designPrescriptionMode}=await server.ssrLoadModule('/src/groups/designRules.js');
 const Guard=(await server.ssrLoadModule('/src/groups/DesignGuard.jsx')).default;
 const Fields=(await server.ssrLoadModule('/src/groups/ProgramFields.jsx')).default;
 const {CORE_LIFTS}=await server.ssrLoadModule('/src/groups/coreLifts.js');
 const book=JSON.parse(fs.readFileSync('web/src/groups/preseasonDesignRules.json','utf8'));
 assert(fs.readFileSync('supabase/migrations/20261113010227_preseason_design_guards.sql','utf8').includes(JSON.stringify(book)),'Client and server share the exact rulebook');
 const render=(C,p)=>renderToStaticMarkup(React.createElement(C,p));
 for(const [date,reps,rpe] of [['2026-11-23',8,6],['2026-11-30',6,7],['2026-12-07',4,7],['2026-12-14',4,6]]){
  const rule=designRule(date,'gentle_strength');
  const m=defaultDesignMovement(CORE_LIFTS[0],rule);
  assert.equal(m.sets[0].reps,reps);assert.equal(10-m.sets[0].rir,rpe);
  const converted={...m,...designPrescriptionMode(m,'percent_1rm',rule)};
  if(!rule.maintainWeek)assert(!designIssues({movements:[converted]},rule).some(x=>x.includes('강도')),'Default percent respects weekly guidance');
 }
 const r1=designRule('2026-11-23','gentle_strength'),r3=designRule('2026-12-07','gentle_strength'),r4=designRule('2026-12-14','gentle_strength');
 const valid={description:'body',movements:r1.required.map(id=>defaultDesignMovement(CORE_LIFTS.find(e=>e.id===id),r1))};
 assert.deepEqual(designIssues(valid,r1),[]);
 assert(designIssues({...valid,movements:valid.movements.slice(0,1)},r1).some(x=>x.includes('행 파워')));
 const reference=r3.required.map(id=>defaultDesignMovement(CORE_LIFTS.find(e=>e.id===id),r3));
 const reset={movements:r4.required.map(id=>defaultDesignMovement(CORE_LIFTS.find(e=>e.id===id),r4,reference))};
 assert.deepEqual(designIssues(reset,r4,reference),[]);
 reset.movements[0].sets.pop();assert(designIssues(reset,r4,reference).some(x=>x.includes('세트·반복')));
 const blank=render(Guard,{program:{movements:[],description:''},date:'2026-11-23',type:'gentle_strength',onChange:()=>{}});
 assert(blank.includes('누락된 필수 운동 추가')&&!blank.includes('textarea'),'Untouched empty weekly slots can remain empty');
 const missing=render(Guard,{program:{movements:[],description:'written workout'},date:'2026-11-23',type:'gentle_strength',onChange:()=>{}});
 assert(missing.includes('required=""')&&missing.includes('minLength="20"')&&missing.includes('관리자 전용'));
 const fields=render(Fields,{form:valid,date:'2026-11-23',classType:'gentle_strength',exercises:CORE_LIFTS,onChange:()=>{}});
 assert(fields.includes('설계 기준')&&fields.includes('value="8"')&&!fields.includes('수업명'));
 assert.equal(designRule('2026-11-22','gentle_strength'),null);assert.equal(designRule('2026-11-23','gentle_sweat'),null);
 assert.deepEqual(designRule('2026-12-28','bomb_strength').required,[]);
 console.log('PASS: exact shared rulebook, week defaults, percentage defaults, exact lift coverage, reset volume, exceptions and untouched empty slots');
}finally{await server.close()}
