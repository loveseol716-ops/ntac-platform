// Authentication and authorization are deliberately inside the handler so ES256
// sessions work without relying on the legacy gateway JWT verifier.
export function passwordHandler(createClient, env) {
  return async (req) => {
    const headers = {
      "Access-Control-Allow-Origin": "https://loveseol716-ops.github.io",
      "Access-Control-Allow-Headers":
        "authorization, x-client-info, apikey, content-type",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    };
    const reply = (status, body) =>
      new Response(JSON.stringify(body), { status, headers });
    if (req.method === "OPTIONS")
      return new Response(null, { status: 204, headers });
    if (req.method !== "POST")
      return reply(405, { error: "지원하지 않는 요청입니다." });
    try {
      const token = req.headers
        .get("Authorization")
        ?.match(/^Bearer (.+)$/i)?.[1];
      if (!token) return reply(401, { error: "다시 로그인해 주세요." });
      const admin = createClient(
        env("SUPABASE_URL"),
        env("SUPABASE_SERVICE_ROLE_KEY"),
        { auth: { persistSession: false, autoRefreshToken: false } },
      );
      const { data: auth, error: authError } = await admin.auth.getUser(token);
      if (authError || !auth?.user)
        return reply(401, { error: "다시 로그인해 주세요." });
      const { data: actor, error: actorError } = await admin
        .from("profiles")
        .select("role")
        .eq("id", auth.user.id)
        .single();
      if (actorError || !["owner", "admin"].includes(actor?.role))
        return reply(403, { error: "관리자 권한이 필요합니다." });
      const body = await req.json();
      if (
        typeof body.target_id !== "string" ||
        !/^[0-9a-f-]{36}$/i.test(body.target_id) ||
        typeof body.password !== "string" ||
        body.password.length < 12 ||
        body.password.length > 128
      )
        return reply(400, { error: "새 비밀번호는 12~128자로 입력해 주세요." });
      const { data: target, error: targetError } = await admin
        .from("profiles")
        .select("role")
        .eq("id", body.target_id)
        .single();
      if (targetError || target?.role !== "member")
        return reply(403, {
          error: "일반 회원의 비밀번호만 변경할 수 있습니다.",
        });
      const { error } = await admin.auth.admin.updateUserById(body.target_id, {
        password: body.password,
      });
      if (error)
        return reply(400, {
          error:
            "비밀번호를 변경하지 못했어요. 기존과 다른 비밀번호를 입력해 주세요.",
        });
      return reply(200, { success: true });
    } catch {
      return reply(400, {
        error: "요청을 처리하지 못했어요. 다시 확인해 주세요.",
      });
    }
  };
}
