// Stable exercise identities: preserve historical records, restrict new core entries.
export const CORE_LIFTS = [
  { id: "back_squat", name: "백 스쿼트" },
  { id: "front_squat", name: "프론트 스쿼트" },
  { id: "bench_press", name: "벤치 프레스" },
  { id: "pendlay_row", name: "팬들레이 로우" },
  { id: "deadlift", name: "컨벤셔널 데드리프트" },
  { id: "overhead_press", name: "오버헤드 프레스" },
  { id: "push_press", name: "푸시 프레스" },
  { id: "push_jerk", name: "푸시 저크" },
  { id: "power_clean", name: "파워 클린" },
  { id: "hang_power_clean", name: "행 파워 클린" },
];
export const isCoreLift = (id) => CORE_LIFTS.some((lift) => lift.id === id);
export const coreExercises = (exercises = []) => CORE_LIFTS.filter((lift) => exercises.some((e) => e.id === lift.id));
export const setRpe = (set) => set.rir == null ? "" : 10 - Number(set.rir);
export function coreMovement(m) {
  if (!isCoreLift(m.exercise_id) || m.training_type !== "strength") return m;
  return { ...m, label: CORE_LIFTS.find((lift) => lift.id === m.exercise_id).name,
    kind: "weight", training_type: "strength", unit: "kg", load_basis: "total", record_use: "strength_estimate",
    sets: m.sets?.length ? m.sets : [{ reps: m.target_reps || 8, rir: 3 }],
    load_step: 2.5, min_load: 0 };
}

export const isPercentPrescription = (m) => m.prescription_mode === "percent_1rm";
export const setIntensityText = (m,s) => isPercentPrescription(m) ? `${s.percent_1rm}% 1RM` : `RPE ${setRpe(s)}`;
export function changePrescriptionMode(m,mode) {
  return {prescription_mode:mode,sets:m.sets.map((s)=>{
    const {rir,percent_1rm,...rest}=s;
    return mode==="percent_1rm" ? {...rest,percent_1rm:percent_1rm??75} : {...rest,rir:rir??3};
  })};
}
