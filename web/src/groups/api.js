import { supabase } from "../lib/supabase.js";
import { dateRange } from "./model.js";
export async function checked(request) {
  const { data, error } = await request;
  if (error) throw error;
  return data;
}
export const rpc = (name, args = {}) => checked(supabase.rpc(name, args));
export async function listClasses(day) {
  const [start, end] = dateRange(day);
  return checked(
    supabase
      .from("group_classes")
      .select("*")
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
export const history = (uid) =>
  checked(
    supabase
      .from("group_participants")
      .select("*,group_classes(*)")
      .eq("user_id", uid)
      .order("joined_at", { ascending: false })
      .limit(200),
  );
