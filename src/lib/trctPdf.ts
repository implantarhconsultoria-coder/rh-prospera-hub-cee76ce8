import { formatCurrency } from './calculations';
import { causaLabel, type TrctResultado, type CausaAfastamento } from './trctCalc';

export interface TrctPdfData {
  // empregador
  empresaNome: string;
  empresaCnpj?: string;
  empresaEndereco?: string;
  empresaBairro?: string;
  empresaMunicipio?: string;
  empresaUf?: string;
  empresaCep?: string;
  empresaCnae?: string;
  // trabalhador
  funcionarioNome: string;
  pisPasep?: string;
  cpf?: string;
  endereco?: string;
  bairro?: string;
  municipio?: string;
  uf?: string;
  cep?: string;
  ctps?: string;
  dataNascimento?: string;
  nomeMae?: string;
  // contrato
  cargo?: string;
  categoriaTrabalhador?: string;
  tipoContrato?: string;
  causa: CausaAfastamento;
  codigoAfastamento?: string;
  remuneracaoMesAnterior: number;
  dataAdmissao?: string;
  dataAviso?: string;
  dataAfastamento?: string;
  codigoSindical?: string;
  sindicatoCnpj?: string;
  sindicatoNome?: string;

  resultado: TrctResultado;
  observacoes?: string;
}

const css = `
  body { font-family: Arial, sans-serif; font-size: 10px; color: #111; padding: 14px; }
  h1 { margin: 0 0 8px; font-size: 13px; text-align: center; text-transform: uppercase; }
  h2 { margin: 10px 0 4px; font-size: 11px; background:#222; color:#fff; padding: 3px 6px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 4px; }
  th, td { border: 1px solid #444; padding: 3px 5px; vertical-align: top; }
  th { background: #eee; text-align: left; }
  .num { text-align: right; }
  .total { background: #eee; font-weight: bold; }
  .liq { background: #000; color: #fff; padding: 6px; margin-top: 6px; text-align: right; font-size: 12px; }
  .lbl { font-size: 8px; color:#555; display:block; }
`;

const row = (label: string, val: string) => `<td><span class="lbl">${label}</span>${val || '—'}</td>`;

export const buildTrctHtml = (d: TrctPdfData): string => {
  const r = d.resultado;
  const verbas: [string, number][] = [
    ['50 — Saldo de salário (' + r.diasTrabalhadosMes + ' dias)', r.v50_saldoDiasSalario],
    ['51 — Comissões', r.v51_comissoes],
    ['52 — Gratificação', r.v52_gratificacao],
    ['53 — Adicional de Insalubridade', r.v53_insalubridade],
    ['54 — Adicional de Periculosidade', r.v54_periculosidade],
    ['55 — Adicional Noturno', r.v55_adicNoturno],
    ['56.1 — Horas Extras', r.v56_horasExtras],
    ['57 — Gorjetas', r.v57_gorjetas],
    ['58 — DSR', r.v58_dsr],
    ['59 — Reflexo do DSR sobre salário variável', r.v59_reflexoDsr],
    ['60 — Multa Art. 477, §8º/CLT', r.v60_multa477],
    ['61 — Multa Art. 479/CLT', r.v61_multa479],
    ['62 — Salário-Família', r.v62_salarioFamilia],
    [`63 — 13º Salário Proporcional (${r.mesesAvos13}/12)`, r.v63_13Proporcional],
    ['64.1 — 13º Salário Exercício', r.v64_13Exercicio],
    [`65 — Férias Proporcionais (${r.mesesAvosFerias}/12)`, r.v65_feriasProporcionais],
    ['66.1 — Férias Vencidas', r.v66_feriasVencidas],
    ['68 — Terço Constitucional de Férias', r.v68_tercoFerias],
    [`69 — Aviso Prévio Indenizado (${r.diasAviso} dias)`, r.v69_avisoIndenizado],
    ['70 — 13º Salário sobre Aviso Prévio Indenizado', r.v70_13SobreAviso],
    ['71 — Férias sobre Aviso Prévio Indenizado', r.v71_feriasSobreAviso],
  ];

  const deducoes: [string, number][] = [
    ['100 — Pensão Alimentícia', r.d100_pensao],
    ['101 — Adiantamento Salarial', r.d101_adiantamento],
    ['102 — Adiantamento de 13º Salário', r.d102_adiant13],
    ['103 — Aviso Prévio Indenizado', r.d103_avisoIndenizado],
    ['104 — Indenização Art. 480 CLT', r.d104_indenizacao480],
    ['105 — Empréstimo em Consignação', r.d105_emprestimoConsig],
    ['106 — Vale-Transporte', r.d106_valeTransporte],
    ['112.1 — Previdência Social', r.d112_1_inss],
    ['112.2 — Previdência Social sobre 13º Salário', r.d112_2_inss13],
    ['114.1 — IRRF', r.d114_1_irrf],
    ['114.2 — IRRF sobre 13º Salário', r.d114_2_irrf13],
    ['115.2 — Arredondamento Anterior', r.d115_2_arredondamento],
    ['115.3 — Desconto Vale Refeição', r.d115_3_valeRefeicao],
  ];

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>TRCT — ${d.funcionarioNome}</title><style>${css}</style></head><body>
    <h1>Termo de Rescisão do Contrato de Trabalho</h1>

    <h2>Identificação do Empregador</h2>
    <table><tr>
      ${row('CNPJ/CEI', d.empresaCnpj || '')}
      ${row('Razão Social', d.empresaNome)}
      ${row('CNAE', d.empresaCnae || '')}
    </tr><tr>
      ${row('Endereço', d.empresaEndereco || '')}
      ${row('Bairro', d.empresaBairro || '')}
      ${row('Município', (d.empresaMunicipio || '') + (d.empresaUf ? ' / ' + d.empresaUf : ''))}
    </tr><tr>
      ${row('CEP', d.empresaCep || '')}
      <td colspan="2"></td>
    </tr></table>

    <h2>Identificação do Trabalhador</h2>
    <table><tr>
      ${row('PIS/PASEP', d.pisPasep || '')}
      ${row('Nome', d.funcionarioNome)}
      ${row('CPF', d.cpf || '')}
    </tr><tr>
      ${row('Endereço', d.endereco || '')}
      ${row('Bairro', d.bairro || '')}
      ${row('Município/UF', (d.municipio || '') + (d.uf ? ' / ' + d.uf : ''))}
    </tr><tr>
      ${row('CEP', d.cep || '')}
      ${row('CTPS', d.ctps || '')}
      ${row('Data Nascimento', d.dataNascimento || '')}
    </tr><tr>
      ${row('Nome da Mãe', d.nomeMae || '')}
      <td colspan="2"></td>
    </tr></table>

    <h2>Dados do Contrato</h2>
    <table><tr>
      ${row('Tipo de contrato', d.tipoContrato || 'Indeterminado')}
      ${row('Causa do afastamento', causaLabel(d.causa))}
      ${row('Código', d.codigoAfastamento || '')}
    </tr><tr>
      ${row('Categoria', d.categoriaTrabalhador || '')}
      ${row('Remuneração mês anterior', formatCurrency(d.remuneracaoMesAnterior))}
      ${row('Data de admissão', d.dataAdmissao || '')}
    </tr><tr>
      ${row('Data do aviso', d.dataAviso || '')}
      ${row('Data de afastamento', d.dataAfastamento || '')}
      ${row('Código sindical', d.codigoSindical || '')}
    </tr><tr>
      ${row('Sindicato (CNPJ)', d.sindicatoCnpj || '')}
      ${row('Sindicato (nome)', d.sindicatoNome || '')}
      <td></td>
    </tr></table>

    <h2>Discriminação das Verbas Rescisórias</h2>
    <table>
      <thead><tr><th style="width:75%">Descrição</th><th class="num">Valor (R$)</th></tr></thead>
      <tbody>
        ${verbas.map(([l, v]) => `<tr><td>${l}</td><td class="num">${formatCurrency(v)}</td></tr>`).join('')}
        <tr class="total"><td class="num">TOTAL BRUTO</td><td class="num">${formatCurrency(r.totalBruto)}</td></tr>
      </tbody>
    </table>

    <h2>Deduções</h2>
    <table>
      <thead><tr><th style="width:75%">Descrição</th><th class="num">Valor (R$)</th></tr></thead>
      <tbody>
        ${deducoes.map(([l, v]) => `<tr><td>${l}</td><td class="num">${formatCurrency(v)}</td></tr>`).join('')}
        <tr class="total"><td class="num">TOTAL DEDUÇÕES</td><td class="num">${formatCurrency(r.totalDedu)}</td></tr>
      </tbody>
    </table>

    <div class="liq">VALOR RESCISÓRIO LÍQUIDO: ${formatCurrency(r.liquidoRescisorio)}</div>

    ${d.observacoes ? `<h2>Observações</h2><p>${d.observacoes}</p>` : ''}

    <p style="margin-top:24px;">_____________________________________<br>Assinatura do trabalhador</p>
    <p style="margin-top:18px;">_____________________________________<br>Assinatura do empregador</p>
  </body></html>`;
};
