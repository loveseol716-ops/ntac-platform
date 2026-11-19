import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(new URL('../web/package.json',import.meta.url));
const React=require('react'),{renderToStaticMarkup}=require('react-dom/server');
const {createServer}=await import(require.resolve('vite'));
process.env.VITE_SUPABASE_URL='https://test.supabase.co';process.env.VITE_SUPABASE_PUBLISHABLE_KEY='test-key';
const server=await createServer({root:new URL('../web',import.meta.url).pathname,server:{middlewareMode:true},appType:'custom'});
try{
 const {NoticeCards,NoticeEditor,safeNoticeLink}=await server.ssrLoadModule('/src/groups/GroupNotices.jsx');
 const render=(C,p)=>renderToStaticMarkup(React.createElement(C,p));
 const notice={id:'p',title:'공지 <script>',body:'첫 줄\n<script>alert(1)</script>',pinned:true,is_published:true,created_at:'2026-11-19T00:00:00Z',link_url:'https://example.com/apply'};
 const member=render(NoticeCards,{notices:[notice]});
 assert(member.includes('중요')&&member.includes('2026')&&member.includes('첫 줄'));
 assert(member.includes('&lt;script&gt;')&&!member.includes('<script>'),'Plain text must stay escaped');
 assert(member.includes('noopener noreferrer')&&!member.includes('>수정<')&&!member.includes('>삭제<'));
 const admin=render(NoticeCards,{notices:[{...notice,is_published:false}],canManage:true});
 assert(admin.includes('비공개')&&admin.includes('>수정<')&&admin.includes('>삭제<'));
 assert.equal(safeNoticeLink('javascript:alert(1)'),null);assert.equal(safeNoticeLink('data:text/html,a'),null);assert.equal(safeNoticeLink('https://example.com/'),'https://example.com/');
 const unsafe=render(NoticeCards,{notices:[{...notice,link_url:'javascript:alert(1)'}]});assert(!unsafe.includes('href='));
 const form=render(NoticeEditor,{notice:null,onSave:()=>{},onClose:()=>{}});
 for(const text of ['제목','내용','연결 링크','상단 고정','멤버에게 공개','공지 게시'])assert(form.includes(text));
 assert(form.includes('maxLength="120"')&&form.includes('maxLength="10000"'));
 assert(fs.readFileSync('web/src/groups/GroupMember.jsx','utf8').includes('["notices", "공지"]'));
 assert(fs.readFileSync('web/src/groups/GroupAdmin.jsx','utf8').includes('<GroupNotices canManage={admin} />'));
 console.log('PASS: plain-text notices, safe links, dates, admin-only actions, editor fields and member/admin navigation');
}finally{await server.close();}
