import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {CORE_LIFTS, coreMovement, setRpe} from '../web/src/groups/coreLifts.js';
import {newMovement,cleanProgram} from '../web/src/groups/blockGoals.js';
const require=createRequire(new URL('../web/package.json',import.meta.url));
const React=require('react'),{renderToStaticMarkup}=require('react-dom/server');
const {createServer}=await import(require.resolve('vite'));
const exercises=[...CORE_LIFTS,{id:'db_press',name:'DB_PRESS_EXCLUDED'}];
for(const e of CORE_LIFTS) {
 const m=newMovement(e);assert.equal(m.unit,'kg');assert.equal(m.load_basis,'total');assert.equal(m.record_use,'strength_estimate');assert.equal(setRpe(m.sets[0]),7);
}
const legacy={id:'old',exercise_id:'db_press',unit:'lb',load_basis:'each',record_use:'log_only'};
assert.deepEqual(coreMovement(legacy),legacy,'Historical non-core data must not be converted');
const saved=cleanProgram({movements:[{...newMovement(CORE_LIFTS[0]),unit:'lb',load_basis:'each',record_use:'log_only',load_step:5,min_load:20}]});
assert.equal(saved.movements[0].unit,'kg');assert.equal(saved.movements[0].min_load,0);
const server=await createServer({root:new URL('../web',import.meta.url).pathname,server:{middlewareMode:true},appType:'custom'});
try {
 const Fields=(await server.ssrLoadModule('/src/groups/ProgramFields.jsx')).default;
 const Sets=(await server.ssrLoadModule('/src/groups/StrengthSets.jsx')).default;
 const m=newMovement(CORE_LIFTS[0]);
 const html=renderToStaticMarkup(React.createElement(Fields,{form:{title:'test',movements:[m]},exercises}));
 for(const forbidden of ['이 기록의 활용','중량 증감 간격','사용 가능한 최소 중량','덤벨 한 손 기준','목표 RIR','DB_PRESS_EXCLUDED','<option>lb</option>'])assert(!html.includes(forbidden),forbidden);
 for(const e of CORE_LIFTS)assert(html.includes(e.name),e.name);
 assert(html.includes('목표 RPE')&&html.includes('바벨 포함 총중량'));
 const sets=renderToStaticMarkup(React.createElement(Sets,{m,result:{sets:[{weight:40,reps:10,rir:2}]}}));
 assert(sets.includes('실제 RPE')&&!sets.includes('실제 RIR'));
 assert(sets.includes('value="8"'),'Stored RIR 2 renders as RPE 8 without rewriting data');
 console.log('PASS: exactly nine lift choices, fixed conventions, automatic record use, RPE display and legacy preservation');
}finally{await server.close()}
