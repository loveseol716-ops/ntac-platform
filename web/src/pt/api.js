import { supabase } from "../lib/supabase.js";
export async function checked(request) {
  const { data, error } = await request;
  if (error) throw error;
  return data;
}
export async function loadPT(memberId, admin = false) {
  const tables = ["pt_packages", "pt_sessions"];
  const values = await Promise.all(
    tables.map((table) =>
      checked(supabase.from(table).select("*").eq("member_id", memberId)),
    ),
  );
  const notes = admin
    ? await checked(
        supabase
          .from("pt_session_private")
          .select("*")
          .eq("member_id", memberId),
      )
    : [];
  return {
    packages: values[0].sort((a, b) => a.created_at.localeCompare(b.created_at)),
    sessions: values[1].sort((a, b) =>
      `${b.session_date} ${b.start_time}`.localeCompare(
        `${a.session_date} ${a.start_time}`,
      ),
    ),
    assessments: [],
    notes,
  };
}
export async function saveSession(session) {
  return checked(
    supabase.rpc("pt_save_session", {
      payload: {
        ...session,
        session_rpe:
          session.session_rpe === "" ? null : Number(session.session_rpe),
      },
    }),
  );
}
