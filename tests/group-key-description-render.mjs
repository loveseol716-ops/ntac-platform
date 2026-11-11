import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(new URL('../web/package.json',import.meta.url));
const React=require('react'), {renderToStaticMarkup}=require('react-dom/server');
const {createServer}=await import(require.resolve('vite'));
process.env.VITE_SUPABASE_URL='https://test.supabase.co';process.env.VITE_SUPABASE_PUBLISHABLE_KEY='test-key';
const server=await createServer({root:new URL('../web',import.meta.url).pathname,server:{middlewareMode:true},appType:'custom'});
try {
 const Fields=(await server.ssrLoadModule('/src/groups/ProgramFields.jsx')).default;
 const Key=(await server.ssrLoadModule('/src/groups/KeyDescription.jsx')).default;
 const Program=(await server.ssrLoadModule('/src/groups/shared.jsx')).Program;
 const form={title:'Public',description:'PUBLIC_BODY',movements:[],key_description:'SECRET_INTENT\nSecond line'};
 const render=(Component,props)=>renderToStaticMarkup(React.createElement(Component,props));
 const edit=render(Fields,{form,exercises:[]});assert(edit.includes('Key Description')&&edit.includes('SECRET_INTENT')&&edit.includes('maxLength="4000"'));
 assert(!render(Fields,{form,exercises:[],showKeyDescription:false}).includes('SECRET_INTENT'));
 assert(render(Key,{value:form.key_description}).includes('관리자 전용'));
 assert(!render(Program,{c:form,exercises:[]}).includes('SECRET_INTENT'),'Shared member program must never render private intent even if supplied');
 const api=await server.ssrLoadModule('/src/groups/api.js');
 const week={id:'week',program_mode:'class_type',programs:[{class_type_id:'gentle_strength'}]};
 assert.equal(api.attachWeekKeys(week,[{week_id:'week',program_key:'gentle_strength',key_description:'INTENT'}]).programs[0].key_description,'INTENT');
 assert.equal(api.attachWeekKeys({...week,id:'other'},[{week_id:'week',program_key:'gentle_strength',key_description:'INTENT'}]).programs[0].key_description,'');
 console.log('PASS: editor field, administrator-only read panel, shared member renderer exclusion and week-scoped intent hydration');
}finally{await server.close()}
