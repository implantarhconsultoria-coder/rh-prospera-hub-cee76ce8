export interface Employee {
  id: string;
  companyId: string;
  registro: string;
  matriculaEsocial: string;
  name: string;
  cpf: string;
  cargo: string;
  salarioBase: number;
  dataAdmissao: string;
  dataExameMedico: string;
  vrAtivo: boolean;
  vrDiario: number;
  vaAtivo: boolean;
  vaMensal: number;
  vtAtivo: boolean;
  vtValor: number;
  insalubridadeAtiva: boolean;
  insalubridadeValor: number;
  status: 'ativo' | 'afastado' | 'férias' | 'desligado';
  telefone: string;
  email: string;
  endereco: string;
  pix: string;
  banco: string;
  agencia: string;
  conta: string;
  observacoes: string;
}

const CARGOS_INSALUBRES = [
  'guincheiro', 'mecânico', 'mecânico pneumático', 'técnico mecânico',
  'técnico mecânico pleno', 'técnico mecânico junior', 'ajudante de mecânico',
  'técnico mecânico eletricista jr'
];

export const isCargoInsalubre = (cargo: string): boolean =>
  CARGOS_INSALUBRES.some(c => cargo.toLowerCase().includes(c.toLowerCase()));

const INSALUBRIDADE_PADRAO = 648.40;

const emp = (id: string, companyId: string, registro: string, mat: string, name: string, cpf: string, cargo: string, salario: number, admissao: string, exame: string, vr: boolean, va: boolean, vt: boolean, status: Employee['status'] = 'ativo'): Employee => {
  const insalubre = isCargoInsalubre(cargo);
  return {
    id, companyId, registro, matriculaEsocial: mat, name, cpf, cargo, salarioBase: salario,
    dataAdmissao: admissao, dataExameMedico: exame,
    vrAtivo: vr, vrDiario: vr ? 32.00 : 0, vaAtivo: va, vaMensal: va ? 250.00 : 0,
    vtAtivo: vt, vtValor: vt ? 220.00 : 0,
    insalubridadeAtiva: insalubre, insalubridadeValor: insalubre ? INSALUBRIDADE_PADRAO : 0,
    status, telefone: '(11) 9' + Math.floor(10000000 + Math.random() * 90000000),
    email: name.split(' ')[0].toLowerCase() + '@email.com',
    endereco: 'São Paulo, SP', pix: cpf, banco: 'Bradesco', agencia: '1234', conta: '56789-0',
    observacoes: '',
  };
};

export const employees: Employee[] = [];
