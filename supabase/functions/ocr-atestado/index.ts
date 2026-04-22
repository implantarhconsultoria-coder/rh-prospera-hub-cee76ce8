// Edge function: ocr-atestado
// Recebe a URL pública de um arquivo (PDF/imagem) e usa o Lovable AI Gateway
// (google/gemini-2.5-flash) para extrair os dados estruturados do atestado.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface AtestadoExtraido {
  funcionario_nome: string;
  cpf: string;
  data_inicio: string; // YYYY-MM-DD
  data_fim: string;    // YYYY-MM-DD
  dias_cobertos: number;
  cid: string;
  medico: string;
  crm: string;
  texto_bruto: string;
  confianca: number; // 0..1
}

const SYSTEM_PROMPT = `Você é um analisador de atestados médicos brasileiros (CLT).
Receberá uma imagem (ou primeira página de PDF) de um atestado e deve devolver SOMENTE um JSON válido com os campos:
{
  "funcionario_nome": "string (nome completo do paciente/colaborador)",
  "cpf": "string (somente dígitos, vazio se não houver)",
  "data_inicio": "YYYY-MM-DD",
  "data_fim": "YYYY-MM-DD",
  "dias_cobertos": numero inteiro (>=1),
  "cid": "string (ex: Z76.3)",
  "medico": "string (nome completo do médico)",
  "crm": "string (CRM/UF)",
  "texto_bruto": "string (texto do atestado, máx 2000 chars)",
  "confianca": número entre 0 e 1
}
Regras:
- Se não conseguir ler um campo, devolva string vazia ou 0.
- Datas SEMPRE em ISO (YYYY-MM-DD). Se só houver "afastar por X dias" sem data fim, calcule data_fim = data_inicio + X-1 dias.
- Não inclua texto fora do JSON. Sem markdown, sem comentários, sem \`\`\`json.`;

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const fileUrl: string | undefined = body.fileUrl;
    if (!fileUrl) {
      return new Response(
        JSON.stringify({ error: 'fileUrl obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'LOVABLE_API_KEY ausente' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const aiRes = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Extraia os dados deste atestado. Devolva APENAS JSON.' },
              { type: 'image_url', image_url: { url: fileUrl } },
            ],
          },
        ],
        temperature: 0.1,
      }),
    });

    if (!aiRes.ok) {
      const errText = await aiRes.text();
      return new Response(
        JSON.stringify({ error: 'AI gateway falhou', detail: errText }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const aiJson = await aiRes.json();
    const raw: string = aiJson?.choices?.[0]?.message?.content ?? '';
    const cleaned = raw.replace(/```json/gi, '').replace(/```/g, '').trim();

    let parsed: AtestadoExtraido;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      return new Response(
        JSON.stringify({ error: 'JSON inválido vindo da IA', raw: cleaned }),
        { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    return new Response(
      JSON.stringify({ ok: true, data: parsed }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: String(e) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
