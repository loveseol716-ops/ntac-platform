import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(new URL('../web/package.json',import.meta.url));
const React=require('react'), {renderToStaticMarkup}=require('react-dom/server');
const {createServer}=await import(require.resolve('vite'));
const server=await createServer({root:new URL('../web',import.meta.url).pathname,server:{middlewareMode:true},appType:'custom'});
try {
 const {default:Journey,TrainingContext}=await server.ssrLoadModule('/src/groups/TrainingJourney.jsx');
 const Author=(await server.ssrLoadModule('/src/groups/AuthoringContext.jsx')).default;
 const render=(Component,props)=>renderToStaticMarkup(React.createElement(Component,props));
 for(const date of ['2026-11-11','2026-11-16','2026-11-23','2026-11-30','2026-12-07','2026-12-14','2026-12-21','2026-12-28','2027-01-04']) {
   const html=render(Journey,{date});
   assert(!html.includes('undefined')&&!html.includes('NaN'),date);
   if(date<'2027-01-04') {assert(html.includes('20/14lb'));assert(!html.includes('20/14/8'));assert(html.includes('108'));}
 }
 const reset=render(Author,{date:'2026-12-14',classType:'gentle_strength'});
 assert(reset.includes('세트·반복 유지')&&reset.includes('RPE 6~7'));
 const power=render(TrainingContext,{date:'2026-12-21',classType:'bomb_sweat'});
 assert(power.includes('카디오 파워 평가')&&power.includes('20/14lb')&&power.includes('8min OFF'));
 assert(!power.includes('Back Squat'),'class assessment details stay scoped');
 const recovery=render(Author,{date:'2026-12-28',classType:'gentle_sweat'});
 assert(recovery.includes('대사 피로 최소화')&&recovery.includes('낮음'));
 console.log('PASS: current, transition, all preseason weeks, next season, class-specific authoring guidance, assessment WOD and recovery load');
}finally{await server.close()}
