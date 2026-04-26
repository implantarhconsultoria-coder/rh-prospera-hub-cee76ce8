import { formatCurrency } from './calculations';
import { tipoRescisaoLabel, type RescisaoResultado, type TipoRescisao, type AvisoPrevio } from './rescisaoCalc';

interface PdfData {
  empresa: string;
  funcionario: string;
  cargo: string;
  cpf: string;
  admissao: string;
  desligamento: string;
  tipo: TipoRescisao;
  aviso: AvisoPrevio;
  motivo: string;
  observacoes: string;
  resultado: RescisaoResultado;
}

const css = `
  body { font-family: Arial, sans-serif; font-size: 11px; color: #111; padding: 24px; }
  h1 { margin: 0 0 8px; font-size: 16px; }
  h2 { margin: 14px 0 6px; font-size: 12px; border-bottom: 1px solid #999; padding-bottom: 2px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
  th, td { border: 1px solid #999; padding: 4px 6px; text-align: left; }
  th { background: #eee; }
  td.num { text-align: right; }
  .liq { background: #f4f4f4; padding: 8px; margin-top: 8px; text-align: right; border: 2px solid #000; font-size: 14px; }
`;

export const buildRescisaoHtml = (d: PdfData) => {
  const r = d.resultado;
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Rescisão ${d.funcionario}</title><style>${css}</style></head><body>
    <h1>Termo de Rescisão do Contrato de Trabalho (TRCT)</h1>
    <table>
      <tr><th>Empresa</th><td colspan="3">${d.empresa}</td></tr>
      <tr><th>Funcionário</th><td>${d.funcionario}</td><th>CPF</th><td>${d.cpf}</td></tr>
      <tr><th>Cargo</th><td>${d.cargo}</td><th>Admissão</th><td>${d.admissao}</td></tr>
      <tr><th>Desligamento</th><td>${d.desligamento}</td><th>Tipo</th><td>${tipoRescisaoLabel(d.tipo)}</td></tr>
      <tr><th>Aviso prévio</th><td>${d.aviso} (${r.diasAviso} dias)</td><th>Motivo</th><td>${d.motivo || '—'}</td></tr>
    </table>

    <h2>Verbas Rescisórias</h2>
    <table>
      <thead><tr><th>Descrição</th><th>Proventos</th><th>Descontos</th></tr></thead>
      <tbody>
        <tr><td>Saldo de salário</td><td class="num">${formatCurrency(r.saldoSalario)}</td><td></td></tr>
        ${r.avisoPrevioValor > 0 ? `<tr><td>Aviso prévio indenizado</td><td class="num">${formatCurrency(r.avisoPrevioValor)}</td><td></td></tr>` : ''}
        ${r.feriasVencidas > 0 ? `<tr><td>Férias vencidas</td><td class="num">${formatCurrency(r.feriasVencidas)}</td><td></td></tr>` : ''}
        ${r.feriasProporcionais > 0 ? `<tr><td>Férias proporcionais</td><td class="num">${formatCurrency(r.feriasProporcionais)}</td><td></td></tr>` : ''}
        ${r.tercoFerias > 0 ? `<tr><td>1/3 sobre férias</td><td class="num">${formatCurrency(r.tercoFerias)}</td><td></td></tr>` : ''}
        ${r.decimoTerceiro > 0 ? `<tr><td>13º proporcional</td><td class="num">${formatCurrency(r.decimoTerceiro)}</td><td></td></tr>` : ''}
        ${r.multaFgts > 0 ? `<tr><td>Multa FGTS</td><td class="num">${formatCurrency(r.multaFgts)}</td><td></td></tr>` : ''}
        <tr><td>INSS</td><td></td><td class="num">${formatCurrency(r.inss)}</td></tr>
        <tr><td>IRRF</td><td></td><td class="num">${formatCurrency(r.irrf)}</td></tr>
        ${r.outrosDescontos > 0 ? `<tr><td>Outros descontos</td><td></td><td class="num">${formatCurrency(r.outrosDescontos)}</td></tr>` : ''}
      </tbody>
      <tfoot><tr><th>Totais</th>
        <th class="num">${formatCurrency(r.totalProventos)}</th>
        <th class="num">${formatCurrency(r.totalDescontos)}</th>
      </tr></tfoot>
    </table>

    <table>
      <tr>
        <th>FGTS do mês a depositar</th><td class="num">${formatCurrency(r.fgtsMes)}</td>
      </tr>
    </table>

    <div class="liq"><strong>Líquido a receber:</strong> ${formatCurrency(r.liquido)}</div>

    ${d.observacoes ? `<h2>Observações</h2><p>${d.observacoes}</p>` : ''}

    <p style="margin-top:30px;">_____________________________________<br>Assinatura do funcionário</p>
    <p style="margin-top:20px;">_____________________________________<br>Assinatura do empregador</p>
  </body></html>`;
};
