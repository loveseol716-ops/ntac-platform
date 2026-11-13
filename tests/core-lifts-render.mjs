import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {CORE_LIFTS, coreMovement, setRpe, changePrescriptionMode} from '../web/src/groups/coreLifts.js';
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
 assert(!html.includes('수업명'),'No redundant class-title input');
 const percent={...m,...changePrescriptionMode(m,'percent_1rm'),sets:[{reps:3,percent_1rm:78},{reps:3,percent_1rm:82}]};
 assert(!('rir' in changePrescriptionMode(m,'percent_1rm').sets[0]),'No invented RPE when switching to percent');
 assert(!('percent_1rm' in changePrescriptionMode(percent,'rpe').sets[0]),'Switching back clears unused percent');
 const percentHtml=renderToStaticMarkup(React.createElement(Fields,{form:{title:'test',movements:[percent]},exercises}));
 assert(percentHtml.includes('value="78"')&&percentHtml.includes('value="82"')&&percentHtml.includes('목표 %1RM'));
 assert(!percentHtml.includes('세트 RPE')&&!percentHtml.includes('NaN'));
 const cleaned=cleanProgram({class_type_id:'gentle_strength',title:'old custom title',movements:[percent]});
 assert.equal(cleaned.title,'GENTLE STRENGTH');assert.equal(cleaned.movements[0].sets[1].percent_1rm,82);
 const Roster=(await server.ssrLoadModule('/src/groups/ClassFloorRoster.jsx')).default;
 const {RecommendationValue}=await server.ssrLoadModule('/src/groups/shared.jsx');
 for (const [Component,props] of [[Roster,{c:{movements:[percent],status:'live'},participants:[{id:'p',name:'Member',status:'active',recommendations:{[percent.id]:{sets:[{weight:78},{weight:82}]}}}],exercises}], [RecommendationValue,{movement:percent,recommendation:{sets:[{weight:78},{weight:82}]}}], [Sets,{m:percent,result:{}}]]) {
  const output=renderToStaticMarkup(React.createElement(Component,props));
  assert(output.includes('78% 1RM')&&output.includes('82% 1RM')&&!output.includes('NaN'),'Percent labels across floor/member/legacy records');
 }
 const sets=renderToStaticMarkup(React.createElement(Sets,{m,result:{sets:[{weight:40,reps:10,rir:2}]}}));
 assert(sets.includes('실제 RPE')&&!sets.includes('실제 RIR'));
 assert(sets.includes('value="8"'),'Stored RIR 2 renders as RPE 8 without rewriting data');
 console.log('PASS: exactly nine lift choices, fixed conventions, automatic record use, RPE display and legacy preservation');
}finally{await server.close()}
