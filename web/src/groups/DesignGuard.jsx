import {useEffect,useState} from 'react';
import {CORE_LIFTS} from './coreLifts.js';
import {designRule,designIssues,defaultDesignMovement} from './designRules.js';
export function useDesignReference(date,type){
 const [state,setState]=useState({key:'',reference:null,error:''});
 const rule=designRule(date,type),key=`${date}:${type}`;
 useEffect(()=>{let live=true;if(!rule?.maintainWeek)return;
  setState({key,reference:null,error:'',loading:true});
  import('./api.js').then(({rpc})=>rpc('group_design_reference',{day:String(date).slice(0,10),class_type:type})).then(reference=>{if(live)setState({key,reference,error:'',loading:false});}).catch(e=>{if(live)setState({key,reference:null,error:e.message,loading:false});});
  return()=>{live=false;};
 },[date,type,rule?.maintainWeek]);
 return rule?.maintainWeek&&state.key===key ? {reference:state.reference,error:state.error,loading:state.loading} : {reference:null,error:'',loading:!!rule?.maintainWeek};
}
export default function DesignGuard({program,date,type,onChange,reference,error,loading,rule=designRule(date,type)}){
 if(!rule)return null;
 const active=!!(program.description?.trim()||program.movements?.length),issues=active?designIssues(program,rule,reference):[],missing=rule.required.filter(id=>!program.movements.some(m=>m.exercise_id===id&&m.training_type==='strength'));
 return <aside className="g-design-guard" aria-label="주차별 설계 기준">
  <strong>PRE-SEASON {rule.week}주차 · 설계 기준</strong>
  <p>{rule.reps ? `메인 근력 ${rule.reps.join('~')}회 · ` : ''}{rule.rpe ? `RPE ${rule.rpe.join('~')}` : '평가 프로토콜 우선'}{rule.week<6&&' · 행 파워클린 등 기술 훈련은 별도 설계'}</p>
  {rule.note&&<p>{rule.note}</p>}
  {rule.maintainWeek&&<p>3주차와 같은 세트·반복 수를 유지하고 강도만 낮춰요.{loading?' 비교 기준 불러오는 중…':error?' 비교 기준을 불러오지 못했어요. 저장 시 서버에서 다시 확인해요.':''}</p>}
  {rule.rpe&&program.movements.some(m=>m.prescription_mode==='percent_1rm')&&<small>%1RM은 현재 추정식으로 주차 RPE 범위를 환산해 확인해요. 실제 체감 강도를 보장하는 값은 아니에요.</small>}
  {missing.length>0&&<button type="button" disabled={program.movements.length+missing.length>20} onClick={()=>onChange({...program,movements:[...program.movements,...missing.map(id=>defaultDesignMovement(CORE_LIFTS.find(e=>e.id===id),rule,reference))]})}>누락된 필수 운동 추가</button>}
  {issues.length>0 ? <><ul>{issues.map((message,i)=><li key={i}>{message}</li>)}</ul><p>기준 밖 설계는 변경 사유와 대체·보완 계획을 적어야 저장할 수 있어요.</p></> : <p className="g-success">{active ? "필수 운동·주차별 수치 기준 충족" : "미작성 수업은 검사 대상에서 제외돼요."}</p>}
  {(issues.length>0||program.design_exception_reason)&&<label>설계 예외 사유 · 관리자 전용
   <textarea required={issues.length>0} minLength={issues.length>0?20:undefined} maxLength={2000} rows={3} value={program.design_exception_reason||''} onChange={e=>onChange({...program,design_exception_reason:e.target.value})} placeholder="왜 기준을 바꾸는지, 평가 목표를 어떤 훈련으로 보완할지 적어 주세요. (20자 이상)" />
  </label>}
 </aside>;
}
