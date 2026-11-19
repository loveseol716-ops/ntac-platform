import {useCallback,useEffect,useRef,useState} from 'react';
import {supabase} from '../lib/supabase.js';
import {checked,rpc} from './api.js';
import {Dialog} from './shared.jsx';
const PAGE_SIZE=20;
export async function listGroupNotices({offset=0,limit=PAGE_SIZE,manage=false,compact=false}={}) {
 let request=supabase.from('group_notices').select(compact?'id,title,pinned,created_at':'id,title,body,link_url,pinned,is_published,revision,created_at,updated_at').is('deleted_at',null);
 if(!manage)request=request.eq('is_published',true);
 return checked(request.order('pinned',{ascending:false}).order('created_at',{ascending:false}).order('id',{ascending:false}).range(offset,offset+limit-1));
}
export function safeNoticeLink(value) {
 try{const url=new URL(value);return ['http:','https:'].includes(url.protocol)?url.href:null;}catch{return null;}
}
const noticeDate=(value)=>new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(value));
export function NoticeCards({notices,canManage=false,busy=false,onEdit,onDelete}) {
 return <div className="g-notice-list">{notices.map(notice=><article className="g-panel g-notice-card" key={notice.id}>
  <details>
   <summary><span className="g-notice-title">{notice.pinned&&<span className="g-notice-badge">중요</span>}{canManage&&!notice.is_published&&<span className="g-notice-badge is-draft">비공개</span>}<strong>{notice.title}</strong></span><time dateTime={notice.created_at}>{noticeDate(notice.created_at)}</time></summary>
   <div className="g-notice-body"><p>{notice.body}</p>{safeNoticeLink(notice.link_url)&&<a className="g-notice-link" href={safeNoticeLink(notice.link_url)} target="_blank" rel="noopener noreferrer">자세히 보기 · 신청하기</a>}</div>
  </details>
  {canManage&&<div className="g-notice-actions"><button type="button" disabled={busy} onClick={()=>onEdit(notice)}>수정</button><button type="button" className="g-danger" disabled={busy} onClick={()=>onDelete(notice)}>삭제</button></div>}
 </article>)}</div>;
}
export function NoticeEditor({notice,busy,error,onClose,onSave}) {
 const [form,setForm]=useState(()=>notice||{id:crypto.randomUUID(),revision:0,title:'',body:'',link_url:'',pinned:false,is_published:true});
 const [validation,setValidation]=useState('');
 const set=(key,value)=>setForm(old=>({...old,[key]:value}));
 return <Dialog title={notice?'공지 수정':'공지 작성'} onClose={onClose}>
  <form className="g-notice-editor" onSubmit={e=>{e.preventDefault();if(!form.title.trim()||!form.body.trim()){setValidation('제목과 내용을 입력해 주세요.');return;}if(form.link_url?.trim()&&!safeNoticeLink(form.link_url.trim())){setValidation('http:// 또는 https:// 링크를 입력해 주세요.');return;}setValidation('');onSave({...form,title:form.title.trim(),body:form.body.trim(),link_url:form.link_url?.trim()||null});}}>
   <fieldset disabled={busy}>
    <label>제목<input autoFocus required maxLength={120} value={form.title} onChange={e=>set('title',e.target.value)} placeholder="멤버들에게 알릴 내용을 적어 주세요" /></label>
    <label>내용<textarea required maxLength={10000} rows={8} value={form.body} onChange={e=>set('body',e.target.value)} placeholder="공지나 이벤트·프로모션 안내를 작성해 주세요" /></label>
    <label>연결 링크 <small>선택</small><input type="url" maxLength={2000} value={form.link_url||''} onChange={e=>set('link_url',e.target.value)} placeholder="https://" /></label>
    <div className="g-notice-options"><label className="g-check"><input type="checkbox" checked={form.pinned} onChange={e=>set('pinned',e.target.checked)} />상단 고정</label><label className="g-check"><input type="checkbox" checked={form.is_published} onChange={e=>set('is_published',e.target.checked)} />멤버에게 공개</label></div>
    {(error||validation)&&<p className="g-error" role="alert">{validation||error}</p>}
    <button type="submit" className="g-primary g-full">{busy?'저장 중…':form.is_published?'저장 · 공지 게시':'비공개로 저장'}</button>
   </fieldset>
  </form>
 </Dialog>;
}
export default function GroupNotices({canManage=false,compact=false,onOpen}) {
 const [notices,setNotices]=useState([]),[loading,setLoading]=useState(true),[error,setError]=useState(''),[message,setMessage]=useState(''),[editing,setEditing]=useState(null),[busy,setBusy]=useState(false),[hasMore,setHasMore]=useState(false);
 const generation=useRef(0),lock=useRef(false);
 const refresh=useCallback(async()=>{
  const request=++generation.current;setLoading(true);setError('');
  try{const rows=await listGroupNotices({manage:canManage,compact,limit:compact?1:PAGE_SIZE});if(request===generation.current){setNotices(rows);setHasMore(!compact&&rows.length===PAGE_SIZE);}}
  catch(e){if(request===generation.current){setNotices([]);setError(e.message);}}
  finally{if(request===generation.current)setLoading(false);}
 },[canManage,compact]);
 useEffect(()=>{refresh();return()=>{generation.current++;};},[refresh]);
 useEffect(()=>{if(editing)return;const focus=()=>refresh();window.addEventListener('focus',focus);return()=>window.removeEventListener('focus',focus);},[editing,refresh]);
 async function more(){if(lock.current)return;lock.current=true;const current=generation.current;setLoading(true);setError('');
  try{const rows=await listGroupNotices({manage:canManage,offset:notices.length});if(current===generation.current){setNotices(old=>[...old,...rows.filter(r=>!old.some(n=>n.id===r.id))]);setHasMore(rows.length===PAGE_SIZE);}}
  catch(e){if(current===generation.current){setNotices([]);setError(e.message);}}
  finally{if(current===generation.current)setLoading(false);lock.current=false;}
 }
 async function save(form){if(lock.current)return;lock.current=true;setBusy(true);setError('');setMessage('');try{await rpc('group_save_notice',{payload:form});setEditing(null);await refresh();setMessage(form.is_published?'공지를 게시했어요.':'비공개로 저장했어요.');}catch(e){setError(e.message);}finally{setBusy(false);lock.current=false;}}
 async function remove(notice){if(lock.current||!confirm(`‘${notice.title}’ 공지를 삭제할까요?`))return;lock.current=true;setBusy(true);setError('');setMessage('');try{await rpc('group_delete_notice',{notice_id:notice.id,expected_revision:notice.revision});await refresh();setMessage('공지를 삭제했어요.');}catch(e){setError(e.message);}finally{setBusy(false);lock.current=false;}}
 if(compact)return notices.length?<button type="button" className="g-notice-teaser" onClick={onOpen}><span className="g-notice-badge">{notices[0].pinned?'중요 공지':'공지'}</span><strong>{notices[0].title}</strong><span>보기</span></button>:null;
 return <section className="g-notices" aria-label="그룹수업 공지">
  <div className="g-heading"><h2>공지</h2><div className="g-notice-actions"><button disabled={loading||busy} onClick={refresh}>새로고침</button>{canManage&&<button className="g-primary" disabled={busy} onClick={()=>{setError('');setMessage('');setEditing({notice:null});}}>공지 작성</button>}</div></div>
  <p className="g-muted">놀토 소식과 수업·이벤트 안내를 확인해 주세요.</p>
  {error&&!editing&&<p role="alert" className="g-error">{error}</p>}{message&&<p role="status" className="g-success">{message}</p>}
  <NoticeCards notices={notices} canManage={canManage} busy={busy} onEdit={notice=>{setError('');setMessage('');setEditing({notice});}} onDelete={remove} />
  {loading&&<p role="status" className="g-muted">공지를 불러오고 있어요.</p>}
  {!loading&&!error&&!notices.length&&<p className="g-empty">{canManage?'아직 공지가 없어요. 첫 공지를 작성해 주세요.':'등록된 공지가 없어요.'}</p>}
  {hasMore&&<button className="g-full" disabled={loading||busy} onClick={more}>이전 공지 더 보기</button>}
  {editing&&<NoticeEditor notice={editing.notice} busy={busy} error={error} onClose={()=>!busy&&setEditing(null)} onSave={save} />}
 </section>;
}
