// Verify the JWT using Auth, then authorize via the caller's database/RLS context.
// A separate service client is used only for the server-side Auth Admin API.
export function deleteMemberHandler(createClient, env) {
  return async (req) => {
    const headers = {
      "Access-Control-Allow-Origin": "https://loveseol716-ops.github.io",
      "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Content-Type": "application/json", "Cache-Control": "no-store",
    };
    const reply = (status, body) => new Response(JSON.stringify(body), { status, headers });
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers });
    if (req.method !== "POST") return reply(405, { error: "지원하지 않는 요청이에요." });
    let accessBlocked = false;
    try {
      const token = req.headers.get("Authorization")?.match(/^Bearer (.+)$/i)?.[1];
      if (!token) return reply(401, { error: "다시 로그인해 주세요." });
      const caller = createClient(env("SUPABASE_URL"), env("SUPABASE_ANON_KEY"), {
        auth: { persistSession: false, autoRefreshToken: false },
        global: { headers: { Authorization: `Bearer ${token}` } },
      });
      const { data: auth, error: authError } = await caller.auth.getUser(token);
      if (authError || !auth?.user) return reply(401, { error: "다시 로그인해 주세요." });
      const { data: actor, error: actorError } = await caller.from("profiles").select("role,deleted_at").eq("id", auth.user.id).single();
      if (actorError || actor?.deleted_at || !["owner", "admin"].includes(actor?.role)) return reply(403, { error: "관리자 권한이 필요해요." });
      const body = await req.json();
      if (!body || typeof body.target_id !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body.target_id) ||
        typeof body.confirm_email !== "string" || !body.confirm_email.trim() || body.confirm_email.length > 320) return reply(400, { error: "삭제할 회원과 이메일을 확인해 주세요." });
      if (body.target_id === auth.user.id) return reply(403, { error: "본인 계정은 삭제할 수 없어요." });
      // Deny the account before deleting its credentials. This closes the valid
      // JWT window and fails closed if the external Auth operation needs a retry.
      const { error: disableError } = await caller.rpc("ntac_disable_member_account", { target_id: body.target_id, confirm_email: body.confirm_email.trim() });
      if (disableError) return reply(400, { error: disableError.message || "계정 접근을 차단하지 못했어요." });
      accessBlocked = true;
      const admin = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false, autoRefreshToken: false } });
      // Soft-delete Auth to retain all foreign-key-linked class/PT history.
      // This deletes credentials/identities and is irreversible, not a UI hide.
      const { error: deletionError } = await admin.auth.admin.deleteUser(body.target_id, true);
      if (deletionError) return reply(502, { error: "앱 접근은 차단됐지만 로그인 계정 삭제를 완료하지 못했어요. 이 창에서 다시 시도해 주세요.", access_blocked: true });
      return reply(200, { success: true });
    } catch {
      if (accessBlocked) return reply(502, { error: "앱 접근은 차단됐지만 로그인 계정 삭제를 완료하지 못했어요. 이 창에서 다시 시도해 주세요.", access_blocked: true });
      return reply(400, { error: "요청을 처리하지 못했어요. 입력 내용을 확인하고 다시 시도해 주세요." });
    }
  };
}
