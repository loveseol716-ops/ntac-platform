import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(new URL('../web/package.json',import.meta.url));
const React=require('react'),{renderToStaticMarkup}=require('react-dom/server');
const {createServer}=await import(require.resolve('vite'));
process.env.VITE_SUPABASE_URL='https://test.supabase.co';process.env.VITE_SUPABASE_PUBLISHABLE_KEY='test-key';
const server=await createServer({root:new URL('../web',import.meta.url).pathname,server:{middlewareMode:true},appType:'custom'});
try{
 const {TrainingHistoryRows}=await server.ssrLoadModule('/src/groups/MemberTrainingHistory.jsx');
 const base={id:'record',status:'completed',session_rpe:7,group_classes:{title:'Gentle Strength',starts_at:'2026-11-12T01:00:00Z',movements:[{id:'sq',label:'Back Squat',kind:'weight',unit:'kg',training_type:'strength'}]},results:{sq:{sets:[{},{},{weight:40,reps:8,rir:2}]}}};
 const render=(records)=>renderToStaticMarkup(React.createElement(TrainingHistoryRows,{records}));
 const summary=render([{...base,last_sets:{sq:{set_index:3,weight:40,reps:8,rpe:8}}}]);
 assert(summary.includes('Gentle Strength')&&summary.includes('2026-11-12')&&summary.includes('40 kg × 8회')&&summary.includes('운동 RPE 8')&&summary.includes('수업 전체 RPE'));
 const legacy=render([base]);assert(legacy.includes('3세트')&&legacy.includes('운동 RPE 8')&&!legacy.includes('기록 없음'));
 const empty=render([{...base,group_classes:{...base.group_classes,movements:[]},results:{},session_rpe:null}]);assert(empty.includes('저장한 운동 기록은 아직 없어요.'));
 console.log('PASS: dated class history, summary/legacy lift results, distinct lift/session RPE and participation without a record');
}finally{await server.close()}
