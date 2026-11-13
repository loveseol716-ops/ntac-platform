import book from './preseasonDesignRules.json';
import { CORE_LIFTS, coreMovement, isPercentPrescription, percentDefaults } from './coreLifts.js';
const strengthTypes=['gentle_strength','bomb_strength'];
export function designRule(date,type) {
  const day=String(date||'').slice(0,10);
  const parsed=new Date(`${day}T00:00:00Z`);
  if(!Number.isFinite(parsed.getTime())||parsed.toISOString().slice(0,10)!==day)return null;
  if(day<book.start||day>book.end||!strengthTypes.includes(type))return null;
  const week=Math.floor((Date.parse(`${day}T00:00:00Z`)-Date.parse(`${book.start}T00:00:00Z`))/604800000)+1;
  const rule=book.weeks[week-1];
  return {...rule,version:book.version,required:week===6 ? (type==='bomb_strength' ? [] : ['back_squat','hang_power_clean']) : [type==='gentle_strength' ? 'back_squat' : 'hang_power_clean'],assessment:week===6&&type==='gentle_strength'};
}
export const technicalLift=(id)=>['hang_power_clean','power_clean','push_jerk'].includes(id);
export function percentRange(reps,rpe) {
  return [Math.floor(100/(1+(Number(reps)+10-rpe[0])/30)),Math.ceil(100/(1+(Number(reps)+10-rpe[1])/30))];
}
export const intensityPercent=(m,s)=>isPercentPrescription(m)?Number(s.percent_1rm):100/(1+(Number(s.reps)+Number(s.rir))/30);
export function designIssues(program,rule,reference) {
  if(!rule)return [];
  const ms=(program.movements||[]).filter(m=>m.training_type==='strength'),issues=[];
  for(const id of rule.required)if(!ms.some(m=>m.exercise_id===id))issues.push(`${CORE_LIFTS.find(e=>e.id===id)?.name||id} 누락`);
  if(rule.week===6&&!rule.assessment)return issues;
  for(const m of ms){
    const name=m.label||m.exercise_id,expected=rule.assessment ? m.exercise_id==='back_squat' ? [5,5] : m.exercise_id==='hang_power_clean' ? [1,1] : null : technicalLift(m.exercise_id) ? null : rule.reps;
    if(expected&&m.sets?.some(s=>Number(s.reps)<expected[0]||Number(s.reps)>expected[1]))issues.push(`${name}: ${expected[0]}~${expected[1]}회 기준 이탈`);
    if(rule.rpe&&!technicalLift(m.exercise_id)&&m.sets?.some(s=>{
      const [lo,hi]=isPercentPrescription(m) ? percentRange(s.reps,rule.rpe) : rule.rpe;
      const val=isPercentPrescription(m) ? Number(s.percent_1rm) : 10-Number(s.rir);
      return !Number.isFinite(val)||val<lo||val>hi;
    }))issues.push(`${name}: 주차별 강도 기준 이탈`);
    if(rule.maintainWeek){
      const prev=reference?.find(x=>x.exercise_id===m.exercise_id);
      if(!prev)issues.push(`${name}: 3주차 비교 기준 없음`);
      else {
        if(JSON.stringify(prev.sets?.map(s=>s.reps))!==JSON.stringify(m.sets?.map(s=>s.reps)))issues.push(`${name}: 3주차 세트·반복 수 변경`);
        if(m.sets?.some((s,i)=>prev.sets?.[i]&&intensityPercent(m,s)>=intensityPercent(prev,prev.sets[i])))issues.push(`${name}: 3주차보다 강도를 낮춰 주세요`);
      }
    }
  }
  return issues;
}
export function defaultDesignMovement(exercise,rule,reference) {
  const previous=rule?.maintainWeek ? reference?.find(m=>m.exercise_id===exercise.id) : null;
  let reps=technicalLift(exercise.id)?2:(rule?.defaultReps??8);
  if(rule?.assessment)reps=exercise.id==='hang_power_clean'?1:exercise.id==='back_squat'?5:reps;
  const rpe=rule?.defaultRpe??7;
  const resetSets=previous?.sets?.map(s=>isPercentPrescription(previous)?{reps:s.reps,percent_1rm:Math.max(1,technicalLift(exercise.id)?Math.floor(s.percent_1rm*.95):Math.min(Number(s.percent_1rm)-1,Math.round(100/(1+(Number(s.reps)+10-rpe)/30))))}:{reps:s.reps,rir:Math.min(5,Math.max(10-rpe,Number(s.rir)+1))});
  return percentDefaults(coreMovement({prescription_mode:previous?.prescription_mode,id:crypto.randomUUID(),exercise_id:exercise.id,label:exercise.name,training_type:'strength',target_reps:resetSets?.[0]?.reps??reps,
    sets:resetSets||Array.from({length:rule?.defaultSets??3},()=>({reps,rir:10-rpe}))}));
}
export function designPrescriptionMode(m,mode,rule) {
 const sets=m.sets.map(s=>{
  const {rir,percent_1rm,...rest}=s;
  if(mode==='percent_1rm')return {...rest,percent_1rm:rule?.rpe&&!technicalLift(m.exercise_id)?Math.round(100/(1+(Number(s.reps)+10-rule.defaultRpe)/30)):(percent_1rm??75)};
  return {...rest,rir:rule?.rpe&&!technicalLift(m.exercise_id)?10-rule.defaultRpe:(rir??3)};
 });
 return {prescription_mode:mode,sets};
}
