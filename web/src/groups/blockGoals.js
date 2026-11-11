import { coreMovement } from "./coreLifts.js";
import { programReady } from "./classTypes.js";
import { trainingPosition } from "./trainingCycle.js";

export const STRENGTH_TYPES = ["gentle_strength", "bomb_strength"];
export const emptyBlockGoals = () => ({ gentle_strength: [], bomb_strength: [] });
export function goalsForDate(rows, date, classType) {
  // Preparation and transition weeks never silently inherit the next block.
  const block = trainingPosition(date)?.block;
  return block ? rows.find((r) => r.block_id === block.id)?.programs?.[classType] || [] : [];
}
export const newMovement = (exercise) => coreMovement({
  id: crypto.randomUUID(), exercise_id: exercise?.id || "", label: exercise?.name || "",
  kind: "weight", training_type: "strength", record_use: "log_only", target_reps: 10,
  unit: "kg", load_basis: "total",
  sets: [{ reps: 10, rir: 3 }, { reps: 10, rir: 3 }, { reps: 8, rir: 3 }, { reps: 8, rir: 3 }, { reps: 8, rir: 3 }],
  load_step: 2.5, min_load: 20,
});
// Retained for older callers: block goals never insert exercises into a program.
export function previewBlockDefaults(program) {
  return program;
}
export function editProgram(program, key, value) {
  const { _blockPreview, ...rest } = program;
  return { ...rest, [key]: value, _blockDefaultsHandled: true };
}
export function cleanProgram(program) {
  const { _blockDefaultsHandled, _blockPreview, ...rest } = program;
  // Never publish untouched automatic previews.
  return _blockPreview ? { ...rest, movements: [] } : { ...rest, movements: (rest.movements || []).map(coreMovement) };
}
