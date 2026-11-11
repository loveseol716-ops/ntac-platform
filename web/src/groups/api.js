import { supabase } from "../lib/supabase.js";
import { dateRange, weekStart, calendarRange } from "./model.js";
export async function checked(request) {
  const { data, error } = await request;
  if (error) throw error;
  return data;
}
export const rpc = (name, args = {}) => checked(supabase.rpc(name, args));
export async function listClasses(day, view = "week") {
  const [first, last] = calendarRange(day, view);
  const start = dateRange(first)[0],
    end = dateRange(last)[0];
  return checked(
    supabase
      .from("group_classes")
      .select("*")
      .is("archived_at", null)
      .gte("starts_at", start)
      .lt("starts_at", end)
      .order("starts_at"),
  );
}
export const listExercises = () =>
  checked(supabase.from("group_exercises").select("*").order("name"));
export const loadDetail = (id) => rpc("group_detail", { cid: id });
export const saveParticipant = (p, payload) =>
  rpc("group_save_participant", {
    pid: p.id,
    expected_revision: p.revision,
    payload,
  });
export const history = () => rpc("group_my_history");

export async function listWeeks(day, includeKeys = false) {
  const weeks = await checked(
    supabase
      .from("group_weeks")
      .select("*")
      .eq("week_start", weekStart(day))
      .neq("status", "archived"),
  );
  if (!includeKeys || !weeks.length) return weeks;
  const notes = await checked(supabase.from("group_key_descriptions").select("week_id,program_key,key_description").in("week_id", weeks.map((w) => w.id)));
  return weeks.map((w) => attachWeekKeys(w, notes));
}
export function attachWeekKeys(week, notes) {
  const field = week.program_mode === "class_type" ? "programs" : "days";
  return { ...week, [field]: (week[field] || []).map((p) => ({ ...p,
    key_description: notes.find((n) => n.week_id === week.id && n.program_key === String(p.class_type_id || p.dow))?.key_description || "",
  })) };
}
export async function listTemplates(includeKeys = false) {
  const templates = await checked(supabase.from("group_templates").select("*").is("archived_at", null).order("updated_at", { ascending: false }));
  if (!includeKeys || !templates.length) return templates;
  const notes = await checked(supabase.from("group_key_descriptions").select("template_id,key_description").in("template_id", templates.map((t) => t.id)));
  return templates.map((t) => ({ ...t, key_description: notes.find((n) => n.template_id === t.id)?.key_description || "" }));
}
