import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type AppRole =
  | "admin"
  | "filial_praia"
  | "filial_goiania"
  | "financeiro"
  | "faturamento"
  | "tecnico_campo";

const ALLOWED_ROLES: AppRole[] = [
  "admin",
  "filial_praia",
  "filial_goiania",
  "financeiro",
  "faturamento",
  "tecnico_campo",
];

interface Body {
  action: "create" | "update_roles" | "reset_password" | "delete";
  email?: string;
  password?: string;
  nome?: string;
  user_id?: string;
  roles?: AppRole[];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "unauthorized" }, 401);
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const admin = createClient(SUPABASE_URL, SERVICE);
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsErr } = await admin.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims?.sub) {
      return json({ error: "unauthorized", detail: claimsErr?.message }, 401);
    }
    const callerId = claimsData.claims.sub as string;

    // Confirma role admin
    const { data: rolesRow } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", callerId)
      .eq("role", "admin")
      .maybeSingle();

    if (!rolesRow) return json({ error: "forbidden" }, 403);

    const body = (await req.json()) as Body;

    // -------- CREATE --------
    if (body.action === "create") {
      const email = (body.email || "").trim().toLowerCase();
      const password = body.password || "";
      const nome = (body.nome || "").trim();
      const roles = (body.roles || []).filter((r) =>
        ALLOWED_ROLES.includes(r),
      );

      if (!email || !password || password.length < 6) {
        return json({ error: "dados_invalidos" }, 400);
      }
      if (roles.length === 0) {
        return json({ error: "selecione_ao_menos_um_modulo" }, 400);
      }

      const { data: created, error: cErr } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { nome_completo: nome },
      });
      if (cErr || !created.user) {
        return json({ error: cErr?.message || "falha_criar_usuario" }, 400);
      }

      const newId = created.user.id;
      const inserts = roles.map((role) => ({ user_id: newId, role }));
      const { error: rErr } = await admin.from("user_roles").insert(inserts);
      if (rErr) {
        // rollback user
        await admin.auth.admin.deleteUser(newId);
        return json({ error: rErr.message }, 400);
      }

      return json({ ok: true, user_id: newId });
    }

    // -------- UPDATE ROLES --------
    if (body.action === "update_roles") {
      if (!body.user_id) return json({ error: "user_id_obrigatorio" }, 400);
      const roles = (body.roles || []).filter((r) =>
        ALLOWED_ROLES.includes(r),
      );
      if (roles.length === 0) {
        return json({ error: "selecione_ao_menos_um_modulo" }, 400);
      }

      await admin.from("user_roles").delete().eq("user_id", body.user_id);
      const inserts = roles.map((role) => ({ user_id: body.user_id!, role }));
      const { error } = await admin.from("user_roles").insert(inserts);
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true });
    }

    // -------- RESET PASSWORD --------
    if (body.action === "reset_password") {
      if (!body.user_id || !body.password || body.password.length < 6) {
        return json({ error: "dados_invalidos" }, 400);
      }
      const { error } = await admin.auth.admin.updateUserById(body.user_id, {
        password: body.password,
      });
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true });
    }

    // -------- DELETE --------
    if (body.action === "delete") {
      if (!body.user_id) return json({ error: "user_id_obrigatorio" }, 400);
      if (body.user_id === callerId) {
        return json({ error: "nao_pode_apagar_a_si_mesmo" }, 400);
      }
      await admin.from("user_roles").delete().eq("user_id", body.user_id);
      const { error } = await admin.auth.admin.deleteUser(body.user_id);
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true });
    }

    return json({ error: "acao_invalida" }, 400);
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
