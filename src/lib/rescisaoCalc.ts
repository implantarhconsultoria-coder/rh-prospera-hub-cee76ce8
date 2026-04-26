import { calcINSS, calcIRRF, calcFGTS } from './calculations';

export type TipoRescisao =
  | 'sem_justa_causa'
  | 'pedido_demissao'
  | 'acordo_mutuo_484a'
  | 'justa_causa'
  | 'termino_contrato_experiencia'
  | 'rescisao_indireta';

export type AvisoPrevio = 'trabalhado' | 'indenizado' | 'dispensado';

export interface RescisaoInput {
  salarioBase: number;
  dependentes: number;
  dataAdmissao: string; // YYYY-MM-DD
  dataDesligamento: string; // YYYY-MM-DD
  tipo: TipoRescisao;
  aviso: AvisoPrevio;
  saldoFgtsDepositado: number;
  outrosDescontos?: number;
  feriasVencidasMeses?: number; // 0 ou 12 normalmente
}

export interface RescisaoResultado {
  diasAviso: number;
  saldoSalario: number;
  avisoPrevioValor: number;
  feriasVencidas: number;
  feriasProporcionais: number;
  tercoFerias: number;
  decimoTerceiro: number;
  inss: number;
  irrf: number;
  fgtsMes: number;
  multaFgts: number;
  outrosDescontos: number;
  totalProventos: number;
  totalDescontos: number;
  liquido: number;
  detalhe: Record<string, number>;
}

const diffMeses = (inicio: Date, fim: Date) => {
  const ms = fim.getTime() - inicio.getTime();
  return ms / (1000 * 60 * 60 * 24 * 30.4375);
};

const diffAnos = (inicio: Date, fim: Date) => diffMeses(inicio, fim) / 12;

export const calcularRescisao = (i: RescisaoInput): RescisaoResultado => {
  const adm = new Date(i.dataAdmissao);
  const desl = new Date(i.dataDesligamento);
  const sal = i.salarioBase;
  const valorDia = sal / 30;
  const dependentes = i.dependentes || 0;
  const saldoFgts = i.saldoFgtsDepositado || 0;

  // 1. Dias de aviso (Lei 12.506: 30 + 3 por ano completo, máx 90)
  const anos = Math.floor(diffAnos(adm, desl));
  const diasAvisoBase = Math.min(90, 30 + Math.max(0, anos - 1) * 3);

  let diasAviso = 0;
  let avisoPrevioValor = 0;
  if (i.tipo === 'sem_justa_causa' || i.tipo === 'rescisao_indireta') {
    if (i.aviso === 'indenizado') {
      diasAviso = diasAvisoBase;
      avisoPrevioValor = valorDia * diasAviso;
    } else if (i.aviso === 'trabalhado') {
      diasAviso = diasAvisoBase;
      // já trabalhado - não vira provento separado
    }
  } else if (i.tipo === 'acordo_mutuo_484a') {
    if (i.aviso === 'indenizado') {
      diasAviso = diasAvisoBase;
      avisoPrevioValor = (valorDia * diasAviso) / 2; // metade
    } else if (i.aviso === 'trabalhado') {
      diasAviso = diasAvisoBase;
    }
  }
  // pedido_demissao, justa_causa, termino_contrato: sem aviso a receber

  // Data projetada (para cálculo de proporcionais quando aviso é indenizado)
  const projetada = new Date(desl);
  if (avisoPrevioValor > 0) projetada.setDate(projetada.getDate() + diasAviso);

  // 2. Saldo de salário: dias trabalhados no mês do desligamento
  const diaDesl = desl.getDate();
  const saldoSalario = valorDia * diaDesl;

  // 3. Férias vencidas (passadas pelo input ou 0)
  const mesesVencidos = i.feriasVencidasMeses ?? 0;
  const feriasVencidas = i.tipo === 'justa_causa' ? 0 : (mesesVencidos >= 12 ? sal : 0);

  // 4. Férias proporcionais e 13º proporcional baseado em meses trabalhados no período aquisitivo / ano
  // Período aquisitivo de férias: meses desde último aniversário de admissão (ou desde admissão)
  let mesesPeriodoFerias = 0;
  const ultimoAniv = new Date(projetada);
  ultimoAniv.setFullYear(adm.getFullYear() + Math.max(1, Math.floor(diffAnos(adm, projetada))));
  // tentativa simples: pega o aniversário anterior à data projetada
  let ref = new Date(adm);
  while (true) {
    const next = new Date(ref);
    next.setFullYear(next.getFullYear() + 1);
    if (next > projetada) break;
    ref = next;
  }
  mesesPeriodoFerias = Math.min(12, Math.floor(diffMeses(ref, projetada)));
  // Considera frações > 14 dias como mês completo
  const fracDias = (projetada.getTime() - new Date(ref.getFullYear(), ref.getMonth() + mesesPeriodoFerias, ref.getDate()).getTime()) / (1000 * 60 * 60 * 24);
  if (fracDias >= 15) mesesPeriodoFerias = Math.min(12, mesesPeriodoFerias + 1);

  let feriasProporcionais = 0;
  if (i.tipo !== 'justa_causa' && i.tipo !== 'pedido_demissao') {
    feriasProporcionais = (sal / 12) * mesesPeriodoFerias;
  } else if (i.tipo === 'pedido_demissao' && diffAnos(adm, projetada) >= 1) {
    // após 1 ano, mesmo no pedido de demissão paga proporcionais
    feriasProporcionais = (sal / 12) * mesesPeriodoFerias;
  }

  const tercoFerias = (feriasVencidas + feriasProporcionais) / 3;

  // 5. 13º proporcional: meses trabalhados no ano (jan-dez) do desligamento
  const inicioAno = new Date(projetada.getFullYear(), 0, 1);
  let mesesAno = 0;
  if (adm > inicioAno) {
    mesesAno = Math.floor(diffMeses(adm, projetada));
  } else {
    mesesAno = projetada.getMonth() + 1; // janeiro=1
  }
  mesesAno = Math.min(12, Math.max(0, mesesAno));
  const decimoTerceiro = i.tipo === 'justa_causa' ? 0 : (sal / 12) * mesesAno;

  // 6. INSS sobre saldo+aviso (se indenizado, aviso não tem INSS) e separado sobre 13º
  const baseInssMes = saldoSalario; // aviso indenizado é isento
  const inssMes = calcINSS(baseInssMes);
  const inss13 = calcINSS(decimoTerceiro);
  const inss = inssMes + inss13;

  // 7. IRRF sobre (saldo - inssMes) e separado em 13º (saldo+aviso geralmente)
  const irrfMes = calcIRRF(baseInssMes - inssMes, dependentes);
  const irrf13 = calcIRRF(decimoTerceiro - inss13, dependentes);
  const irrf = irrfMes + irrf13;

  // 8. FGTS do mês: 8% sobre (saldo + 13º + aviso indenizado quando aplicável)
  const baseFgtsMes = saldoSalario + decimoTerceiro + avisoPrevioValor;
  const fgtsMes = calcFGTS(baseFgtsMes);

  // 9. Multa do FGTS sobre saldo depositado informado
  let multaFgts = 0;
  if (i.tipo === 'sem_justa_causa' || i.tipo === 'rescisao_indireta') {
    multaFgts = saldoFgts * 0.4;
  } else if (i.tipo === 'acordo_mutuo_484a') {
    multaFgts = saldoFgts * 0.2;
  }

  const outros = i.outrosDescontos || 0;

  const totalProventos =
    saldoSalario +
    avisoPrevioValor +
    feriasVencidas +
    feriasProporcionais +
    tercoFerias +
    decimoTerceiro +
    multaFgts;

  const totalDescontos = inss + irrf + outros;
  const liquido = totalProventos - totalDescontos;

  return {
    diasAviso,
    saldoSalario,
    avisoPrevioValor,
    feriasVencidas,
    feriasProporcionais,
    tercoFerias,
    decimoTerceiro,
    inss,
    irrf,
    fgtsMes,
    multaFgts,
    outrosDescontos: outros,
    totalProventos,
    totalDescontos,
    liquido,
    detalhe: { inssMes, inss13, irrfMes, irrf13, baseFgtsMes, mesesPeriodoFerias, mesesAno },
  };
};

export const tipoRescisaoLabel = (t: TipoRescisao) => ({
  sem_justa_causa: 'Sem justa causa (empregador)',
  pedido_demissao: 'Pedido de demissão',
  acordo_mutuo_484a: 'Acordo mútuo (Art. 484-A)',
  justa_causa: 'Justa causa',
  termino_contrato_experiencia: 'Término de contrato de experiência',
  rescisao_indireta: 'Rescisão indireta',
}[t]);
