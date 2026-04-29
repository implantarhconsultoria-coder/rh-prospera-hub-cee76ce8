/**
 * Cálculo das verbas e deduções de rescisão no padrão TRCT.
 * Os valores podem ser sobrescritos manualmente pelo admin para bater
 * com arredondamentos contábeis específicos do escritório.
 */
import { calcINSS, calcIRRF } from './calculations';

export type CausaAfastamento =
  | 'sj_empregador' // sem justa causa empregador (SJ2)
  | 'pedido_demissao'
  | 'acordo_484a'
  | 'justa_causa'
  | 'termino_experiencia'
  | 'rescisao_indireta';

export interface TrctInput {
  salarioBase: number;
  remuneracaoMesAnterior?: number;
  insalubridadePct?: number; // 0,20,40
  insalubridadeBase?: number; // base (salário mínimo)
  comissoes?: number;
  gratificacao?: number;
  periculosidade?: number;
  adicionalNoturno?: number;
  horasExtrasValor?: number;
  gorjetas?: number;
  dsrValor?: number;
  reflexoDsr?: number;
  salarioFamilia?: number;

  dependentes?: number;
  dataAdmissao: string;
  dataAviso: string;
  dataAfastamento: string;
  causa: CausaAfastamento;
  avisoTrabalhado: boolean; // true=trabalhado, false=indenizado
  diasAviso?: number; // override

  // Deduções manuais
  pensao?: number;
  adiantamentoSalarial?: number;
  adiantamento13?: number;
  emprestimoConsig?: number;
  valeTransporte?: number;
  valeRefeicao?: number;
  arredondamentoAnterior?: number;
  indenizacao480?: number;

  feriasVencidasMeses?: number;
}

export interface TrctResultado {
  // Verbas
  v50_saldoDiasSalario: number;
  v51_comissoes: number;
  v52_gratificacao: number;
  v53_insalubridade: number;
  v54_periculosidade: number;
  v55_adicNoturno: number;
  v56_horasExtras: number;
  v57_gorjetas: number;
  v58_dsr: number;
  v59_reflexoDsr: number;
  v60_multa477: number;
  v61_multa479: number;
  v62_salarioFamilia: number;
  v63_13Proporcional: number;
  v64_13Exercicio: number;
  v65_feriasProporcionais: number;
  v66_feriasVencidas: number;
  v68_tercoFerias: number;
  v69_avisoIndenizado: number;
  v70_13SobreAviso: number;
  v71_feriasSobreAviso: number;

  // Deduções
  d100_pensao: number;
  d101_adiantamento: number;
  d102_adiant13: number;
  d103_avisoIndenizado: number;
  d104_indenizacao480: number;
  d105_emprestimoConsig: number;
  d106_valeTransporte: number;
  d112_1_inss: number;
  d112_2_inss13: number;
  d114_1_irrf: number;
  d114_2_irrf13: number;
  d115_2_arredondamento: number;
  d115_3_valeRefeicao: number;

  diasAviso: number;
  diasTrabalhadosMes: number;
  mesesAvosFerias: number;
  mesesAvos13: number;

  totalBruto: number;
  totalDedu: number;
  liquidoRescisorio: number;
}

const round2 = (v: number) => Math.round(v * 100) / 100;
const diffAnos = (a: Date, b: Date) => (b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24 * 365.25);

const calcAvosFerias = (admissao: Date, dataFim: Date) => {
  // último período aquisitivo: pega último aniversário <= dataFim
  let ref = new Date(admissao);
  while (true) {
    const next = new Date(ref);
    next.setFullYear(next.getFullYear() + 1);
    if (next > dataFim) break;
    ref = next;
  }
  // meses entre ref e dataFim, com fração ≥15 dias contando como mês
  let meses = (dataFim.getFullYear() - ref.getFullYear()) * 12 + (dataFim.getMonth() - ref.getMonth());
  const diaRef = ref.getDate();
  const diaFim = dataFim.getDate();
  if (diaFim - diaRef >= 15) meses += 1;
  return Math.max(0, Math.min(12, meses));
};

const calcAvos13 = (admissao: Date, dataFim: Date) => {
  // 1/12 por mês trabalhado no ano (≥15 dias = mês)
  const inicio = admissao.getFullYear() === dataFim.getFullYear() ? admissao : new Date(dataFim.getFullYear(), 0, 1);
  let meses = (dataFim.getFullYear() - inicio.getFullYear()) * 12 + (dataFim.getMonth() - inicio.getMonth());
  if (dataFim.getDate() >= 15) meses += 1;
  return Math.max(0, Math.min(12, meses));
};

export const calcularTrct = (i: TrctInput): TrctResultado => {
  const adm = new Date(i.dataAdmissao);
  const aviso = new Date(i.dataAviso);
  const fim = new Date(i.dataAfastamento);
  const sal = Number(i.salarioBase || 0);
  const remunMes = Number(i.remuneracaoMesAnterior || sal);
  const valorDia = remunMes / 30;

  // Dias de aviso (Lei 12.506)
  const anosCompletos = Math.floor(diffAnos(adm, fim));
  const diasAvisoBase = Math.min(90, 30 + Math.max(0, anosCompletos - 1) * 3);
  const diasAviso = i.diasAviso ?? diasAvisoBase;

  const temAvisoIndenizado =
    !i.avisoTrabalhado && (i.causa === 'sj_empregador' || i.causa === 'rescisao_indireta');
  const temAvisoIndenizadoMetade = !i.avisoTrabalhado && i.causa === 'acordo_484a';

  // Saldo de salário: dias trabalhados no mês do desligamento
  const diaAfast = fim.getDate();
  const v50 = round2(valorDia * diaAfast);

  // Insalubridade: pct * base (geralmente salário mínimo). Se não informado mas salário tem insalubridade
  // embutida, usa proporcional aos dias trabalhados.
  const insalBase = Number(i.insalubridadeBase || 0);
  const insalPct = Number(i.insalubridadePct || 0);
  const v53 = round2(((insalBase * (insalPct / 100)) / 30) * diaAfast);

  // Outras verbas variáveis (default 0; admin edita se necessário)
  const v51 = round2(Number(i.comissoes || 0));
  const v52 = round2(Number(i.gratificacao || 0));
  const v54 = round2(Number(i.periculosidade || 0));
  const v55 = round2(Number(i.adicionalNoturno || 0));
  const v56 = round2(Number(i.horasExtrasValor || 0));
  const v57 = round2(Number(i.gorjetas || 0));
  const v58 = round2(Number(i.dsrValor || 0));
  const v59 = round2(Number(i.reflexoDsr || 0));
  const v62 = round2(Number(i.salarioFamilia || 0));

  // Avos 13º proporcional e férias proporcionais
  const proj = new Date(fim);
  if (temAvisoIndenizado || temAvisoIndenizadoMetade) {
    proj.setDate(proj.getDate() + diasAviso);
  }
  const avosFerias = calcAvosFerias(adm, proj);
  const avos13 = calcAvos13(adm, proj);

  let v63 = 0; // 13 proporcional
  let v65 = 0; // ferias proporcionais
  if (i.causa !== 'justa_causa') {
    v63 = round2((remunMes / 12) * avos13);
    v65 = round2((remunMes / 12) * avosFerias);
  }
  const v64 = 0; // 13 do exercício (manual)

  const v66 = (i.feriasVencidasMeses ?? 0) >= 12 && i.causa !== 'justa_causa' ? round2(remunMes) : 0;
  const v68 = round2((v65 + v66) / 3);

  // Aviso indenizado e reflexos
  let v69 = 0, v70 = 0, v71 = 0;
  if (temAvisoIndenizado) {
    v69 = round2((remunMes / 30) * diasAviso);
    v70 = round2(remunMes / 12); // 1/12 sobre aviso
    v71 = round2((remunMes / 12) * (1 + 1 / 3) - remunMes / 12); // 1/3 sobre 1/12 = aprox; aproximação simples
    v71 = round2(remunMes / 12); // 1/12 férias sobre aviso (sem 1/3 separado para não duplicar)
  } else if (temAvisoIndenizadoMetade) {
    v69 = round2((remunMes / 30) * diasAviso / 2);
    v70 = round2(remunMes / 24);
    v71 = round2(remunMes / 24);
  }

  const v60 = 0; // multa 477 — manual
  const v61 = 0; // multa 479 — manual

  const totalBruto = round2(
    v50 + v51 + v52 + v53 + v54 + v55 + v56 + v57 + v58 + v59 + v60 + v61 + v62 +
    v63 + v64 + v65 + v66 + v68 + v69 + v70 + v71,
  );

  // ===== Deduções
  // INSS sobre saldo+adicionais do mês (sem aviso indenizado)
  const baseInssMes = v50 + v51 + v52 + v53 + v54 + v55 + v56 + v57 + v58 + v59 + v62;
  const inss = round2(calcINSS(baseInssMes));
  const inss13 = round2(calcINSS(v63 + v64));
  const irrf = round2(calcIRRF(baseInssMes - inss, i.dependentes || 0));
  const irrf13 = round2(calcIRRF(v63 + v64 - inss13, i.dependentes || 0));

  const d100 = round2(Number(i.pensao || 0));
  const d101 = round2(Number(i.adiantamentoSalarial || 0));
  const d102 = round2(Number(i.adiantamento13 || 0));
  const d103 = i.avisoTrabalhado ? 0 : 0; // só se EMPREGADO devesse aviso e não cumpriu
  const d104 = round2(Number(i.indenizacao480 || 0));
  const d105 = round2(Number(i.emprestimoConsig || 0));
  const d106 = round2(Number(i.valeTransporte || 0));
  const d115_2 = round2(Number(i.arredondamentoAnterior || 0));
  const d115_3 = round2(Number(i.valeRefeicao || 0));

  const totalDedu = round2(d100 + d101 + d102 + d103 + d104 + d105 + d106 + inss + inss13 + irrf + irrf13 + d115_2 + d115_3);

  return {
    v50_saldoDiasSalario: v50,
    v51_comissoes: v51,
    v52_gratificacao: v52,
    v53_insalubridade: v53,
    v54_periculosidade: v54,
    v55_adicNoturno: v55,
    v56_horasExtras: v56,
    v57_gorjetas: v57,
    v58_dsr: v58,
    v59_reflexoDsr: v59,
    v60_multa477: v60,
    v61_multa479: v61,
    v62_salarioFamilia: v62,
    v63_13Proporcional: v63,
    v64_13Exercicio: v64,
    v65_feriasProporcionais: v65,
    v66_feriasVencidas: v66,
    v68_tercoFerias: v68,
    v69_avisoIndenizado: v69,
    v70_13SobreAviso: v70,
    v71_feriasSobreAviso: v71,
    d100_pensao: d100,
    d101_adiantamento: d101,
    d102_adiant13: d102,
    d103_avisoIndenizado: d103,
    d104_indenizacao480: d104,
    d105_emprestimoConsig: d105,
    d106_valeTransporte: d106,
    d112_1_inss: inss,
    d112_2_inss13: inss13,
    d114_1_irrf: irrf,
    d114_2_irrf13: irrf13,
    d115_2_arredondamento: d115_2,
    d115_3_valeRefeicao: d115_3,
    diasAviso,
    diasTrabalhadosMes: diaAfast,
    mesesAvosFerias: avosFerias,
    mesesAvos13: avos13,
    totalBruto,
    totalDedu,
    liquidoRescisorio: round2(totalBruto - totalDedu),
  };
};

export const causaLabel = (c: CausaAfastamento) => ({
  sj_empregador: 'Despedida sem justa causa pelo empregador',
  pedido_demissao: 'Pedido de demissão',
  acordo_484a: 'Acordo mútuo (Art. 484-A)',
  justa_causa: 'Justa causa pelo empregador',
  termino_experiencia: 'Término do contrato de experiência',
  rescisao_indireta: 'Rescisão indireta (justa causa pelo empregado)',
}[c]);

export const codigoAfastamentoSugerido = (c: CausaAfastamento) => ({
  sj_empregador: 'SJ2',
  pedido_demissao: 'PD',
  acordo_484a: 'AM',
  justa_causa: 'JCE',
  termino_experiencia: 'TC',
  rescisao_indireta: 'RI',
}[c]);
