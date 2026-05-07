// Interpreta comandos de voz do admin via Lovable AI Gateway.
// Retorna uma "ação" estruturada que o frontend confirma e executa.
// deno-lint-ignore-file no-explicit-any

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SYSTEM = `Você é um interpretador de comandos de voz em PT-BR para um ERP.
Receba a fala do usuário e devolva UMA ação estruturada via tool call.

Tipos de ação possíveis (action.type):
- "navigate"     -> abrir um módulo. Campos: route (string).
- "open_employee" -> abrir cadastro de funcionário. Campos: query (nome falado).
- "open_company"  -> abrir empresa. Campos: query (nome/sigla falada).
- "print_epi"     -> ficha de EPI. Campos: employee_query, company_query?.
- "print_uniforme" -> ficha de uniforme. Campos: employee_query, company_query?.
- "print_recibo_vr" -> recibo VR individual. Campos: employee_query, company_query?, mes? (1-12), ano?.
- "print_recibo_vt" -> recibo VT individual. Campos: employee_query, company_query?, mes?, ano?.
- "print_relatorio_vr" -> relatório consolidado VR. Campos: company_query?, mes?, ano?.
- "print_relatorio_vt" -> relatório consolidado VT. Campos: company_query?, mes?, ano?.
- "print_protocolo_veiculo" -> protocolo veículo. Campos: placa.
- "unknown" -> não entendi. Campo: reason.

Rotas válidas para "navigate":
/admin, /admin/funcionarios, /admin/empresas, /admin/lancamentos, /admin/fechamento,
/admin/relatorio, /admin/epi, /admin/uniformes, /admin/relatorio-vr, /admin/relatorio-vt,
/admin/almoxarifado, /admin/faturamento, /admin/financeiro, /admin/galoes-combustivel,
/admin/documentos-ativos, /admin/protocolo, /admin/historico, /admin/aso,
/admin/conferencia-ponto, /admin/app-mecanico.

Sempre devolva também "label" curto descrevendo a ação em PT-BR para confirmação humana.
Meses por nome (janeiro=1, fevereiro=2, ...). Se ano não dito, deixe ausente.
Nunca invente dados. Se incerto, devolva "unknown".`;

const tool = {
  type: "function",
  function: {
    name: "emit_action",
    description: "Emite a ação interpretada do comando de voz",
    parameters: {
      type: "object",
      properties: {
        type: {
          type: "string",
          enum: [
            "navigate", "open_employee", "open_company",
            "print_epi", "print_uniforme",
            "print_recibo_vr", "print_recibo_vt",
            "print_relatorio_vr", "print_relatorio_vt",
            "print_protocolo_veiculo", "unknown",
          ],
        },
        label: { type: "string" },
        route: { type: "string" },
        query: { type: "string" },
        employee_query: { type: "string" },
        company_query: { type: "string" },
        mes: { type: "number" },
        ano: { type: "number" },
        placa: { type: "string" },
        reason: { type: "string" },
      },
      required: ["type", "label"],
      additionalProperties: false,
    },
  },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { text } = await req.json();
    if (!text || typeof text !== "string") {
      return new Response(JSON.stringify({ error: "text obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) throw new Error("LOVABLE_API_KEY ausente");

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: text },
        ],
        tools: [tool],
        tool_choice: { type: "function", function: { name: "emit_action" } },
      }),
    });

    if (resp.status === 429) {
      return new Response(JSON.stringify({ error: "Limite de uso excedido, tente novamente em instantes." }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (resp.status === 402) {
      return new Response(JSON.stringify({ error: "Créditos esgotados. Adicione créditos em Lovable AI." }), {
        status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!resp.ok) {
      const t = await resp.text();
      console.error("AI error", resp.status, t);
      return new Response(JSON.stringify({ error: "Falha no interpretador" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await resp.json();
    const call = data?.choices?.[0]?.message?.tool_calls?.[0];
    let action: any = { type: "unknown", label: "Não entendi o comando." };
    if (call?.function?.arguments) {
      try { action = JSON.parse(call.function.arguments); } catch { /* keep unknown */ }
    }

    return new Response(JSON.stringify({ action }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("voice-command error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
