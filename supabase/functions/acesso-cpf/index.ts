// Edge function: valida CPF + token e retorna sessão vinculada ao funcionário oficial.
// Regra única: TODO acesso por CPF deve casar com um registro em public.funcionarios.
// - Operacional: também resolve o token do tecnicos_campo (vinculado ao funcionario_id).
// - Demais módulos (financeiro, faturamento, ...): valida via funcionario_modulos.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const sb = () =>
  createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

const onlyDigits = (s: string) => String(s || "").replace(/\D/g, "");

async function validarPorBaseInterna(client: ReturnType<typeof sb>, slug: string, cpfClean: string) {
  const { data, error } = await client.rpc("validar_acesso_cpf_slug", {
    p_slug: slug,
    p_cpf: cpfClean,
  });

  if (error) {
    return { ok: false, error: "db_error", detalhe: error.message };
  }

  return (data as Record<string, unknown>) || { ok: false, error: "db_error" };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const action = String((body as any).action || "");
    const slug = String((body as any).slug || "").toLowerCase();
    const cpfClean = onlyDigits(String((body as any).cpf || ""));

    if (action !== "entrar") return json({ error: "invalid_action" }, 400);
    if (!slug) return json({ error: "slug_obrigatorio" }, 400);
    if (cpfClean.length !== 11) return json({ error: "cpf_invalido" }, 400);

    const client = sb();
    const data = await validarPorBaseInterna(client, slug, cpfClean);
    const status = data?.ok ? 200 : data?.error === "link_invalido" ? 404 : 403;
    return json(data, status);
  } catch (e) {
    return json({ error: "internal", detalhe: String((e as Error).message || e) }, 500);
  }
});
