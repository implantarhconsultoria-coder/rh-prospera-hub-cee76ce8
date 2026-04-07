export interface Employee {
  id: string;
  companyId: string;
  registro: string;
  matriculaEsocial: string;
  name: string;
  cpf: string;
  rg: string;
  cargo: string;
  categoria: 'operacional' | 'socio';
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
  celular: string;
  email: string;
  endereco: string;
  pix: string;
  banco: string;
  agencia: string;
  conta: string;
  observacoes: string;
  // Sócio specific
  inss?: number;
  liquido?: number;
  referenciaCompetencia?: string;
}

const CARGOS_INSALUBRES = [
  'guincheiro', 'mecânico', 'mecânico pneumático', 'técnico mecânico',
  'técnico mecânico pleno', 'técnico mecânico junior', 'ajudante de mecânico',
  'técnico mecânico eletricista jr', 'torneiro mecanico', 'encarregado de oficina',
  'tecnico mecanico junior', 'tecnico mecanico pleno', 'ajudante mecanico',
  'assistente adm junior'
];

export const isCargoInsalubre = (cargo: string): boolean =>
  CARGOS_INSALUBRES.some(c => cargo.toLowerCase().includes(c.toLowerCase()));

const INSALUBRIDADE_PADRAO = 648.40;

export const employees: Employee[] = [
  // ═══════════════════════════════════════════════════
  // ALQUI OBRAS LTDA — FUNCIONÁRIOS OPERACIONAIS
  // ═══════════════════════════════════════════════════
  {
    id: 'alqui-25', companyId: 'alqui', registro: '25', matriculaEsocial: '',
    name: 'ADALTO JACINTO', cpf: '14295919861', rg: '226555392',
    cargo: 'TORNEIRO MECANICO', categoria: 'operacional',
    salarioBase: 3192.22, dataAdmissao: '2018-05-07', dataExameMedico: '2025-05-07',
    vrAtivo: true, vrDiario: 27.32, vaAtivo: false, vaMensal: 0,
    vtAtivo: true, vtValor: 190.00,
    insalubridadeAtiva: true, insalubridadeValor: INSALUBRIDADE_PADRAO,
    status: 'ativo',
    telefone: '1150414770', celular: '11050414770',
    email: '', endereco: 'R Assis Brasil, 23, CS 1, Conjunto Residencial Morada do, São Paulo, SP, 05281-130',
    pix: '14295919861', banco: '', agencia: '', conta: '', observacoes: '',
  },
  {
    id: 'alqui-40', companyId: 'alqui', registro: '40', matriculaEsocial: '',
    name: 'DIEGO MARTINS SILVA SANTOS', cpf: '53844759867', rg: '505243696',
    cargo: 'TECNICO MECANICO JUNIOR', categoria: 'operacional',
    salarioBase: 2738.62, dataAdmissao: '2021-10-04', dataExameMedico: '2025-10-04',
    vrAtivo: true, vrDiario: 27.32, vaAtivo: false, vaMensal: 0,
    vtAtivo: false, vtValor: 0,
    insalubridadeAtiva: true, insalubridadeValor: INSALUBRIDADE_PADRAO,
    status: 'ativo',
    telefone: '11033937610', celular: '11033937610',
    email: '', endereco: 'R Santa Terezinha, 17, CS 2, Jardim Nova Conquista, São Paulo, SP, 08346-515',
    pix: '53844759867', banco: '', agencia: '', conta: '', observacoes: '',
  },
  {
    id: 'alqui-50', companyId: 'alqui', registro: '50', matriculaEsocial: '',
    name: 'KAYKY CHAFI SERVILIO', cpf: '52891005805', rg: '552299418',
    cargo: 'AJUDANTE DE ALMOXARIFADO', categoria: 'operacional',
    salarioBase: 2228.73, dataAdmissao: '2025-02-27', dataExameMedico: '2025-02-27',
    vrAtivo: true, vrDiario: 27.32, vaAtivo: false, vaMensal: 0,
    vtAtivo: true, vtValor: 508.00,
    insalubridadeAtiva: false, insalubridadeValor: 0,
    status: 'ativo',
    telefone: '11948292122', celular: '11948292122',
    email: '', endereco: 'R Nice, 47, Vila Gustavo, São Paulo, SP, 02266-090',
    pix: '52891005805', banco: '', agencia: '', conta: '', observacoes: '',
  },
  {
    id: 'alqui-17', companyId: 'alqui', registro: '17', matriculaEsocial: '',
    name: 'LEONEL DE SOUZA SANTOS', cpf: '02960408519', rg: '1406715107',
    cargo: 'ENCARREGADO DE OFICINA', categoria: 'operacional',
    salarioBase: 5798.93, dataAdmissao: '2014-10-10', dataExameMedico: '2025-10-10',
    vrAtivo: true, vrDiario: 27.32, vaAtivo: false, vaMensal: 0,
    vtAtivo: false, vtValor: 0,
    insalubridadeAtiva: true, insalubridadeValor: INSALUBRIDADE_PADRAO,
    status: 'ativo',
    telefone: '1150414770', celular: '',
    email: '', endereco: 'R Sebastião Batista, 242, CASA 01, Cidade Tiradentes, São Paulo, SP, 08470-330',
    pix: '02960408519', banco: '', agencia: '', conta: '', observacoes: '',
  },
  {
    id: 'alqui-46', companyId: 'alqui', registro: '46', matriculaEsocial: '',
    name: 'MARCELO SOARES BENTO', cpf: '16113592871', rg: '187838274',
    cargo: 'AUXILIAR OPERACIONAL PLENO', categoria: 'operacional',
    salarioBase: 2658.61, dataAdmissao: '2023-04-06', dataExameMedico: '2025-04-06',
    vrAtivo: true, vrDiario: 27.32, vaAtivo: false, vaMensal: 0,
    vtAtivo: true, vtValor: 787.20,
    insalubridadeAtiva: false, insalubridadeValor: 0,
    status: 'ativo',
    telefone: '11033937610', celular: '11033937610',
    email: '', endereco: 'R Arpão, 71, Jardim Santa Izabel, Cotia, SP, 06709-560',
    pix: '16113592871', banco: '', agencia: '', conta: '', observacoes: '',
  },
  {
    id: 'alqui-51', companyId: 'alqui', registro: '51', matriculaEsocial: '',
    name: 'NACIEL SANTOS DA SILVA', cpf: '45217307870', rg: '401589560',
    cargo: 'TECNICO MECANICO JUNIOR', categoria: 'operacional',
    salarioBase: 2738.62, dataAdmissao: '2025-02-27', dataExameMedico: '2025-02-27',
    vrAtivo: true, vrDiario: 27.32, vaAtivo: false, vaMensal: 0,
    vtAtivo: true, vtValor: 760.00,
    insalubridadeAtiva: true, insalubridadeValor: INSALUBRIDADE_PADRAO,
    status: 'ativo',
    telefone: '11949188090', celular: '11949188090',
    email: '', endereco: 'AV Deputado Emílio Carlos, 72, Vila Caldas, Carapicuíba, SP, 06310-160',
    pix: '45217307870', banco: '', agencia: '', conta: '', observacoes: '',
  },
  {
    id: 'alqui-53', companyId: 'alqui', registro: '53', matriculaEsocial: '',
    name: 'RODRIGO DE SOUZA SABINO', cpf: '38665547886', rg: '426368265',
    cargo: 'ASSISTENTE ADM JUNIOR', categoria: 'operacional',
    salarioBase: 2896.99, dataAdmissao: '2025-06-09', dataExameMedico: '2025-06-09',
    vrAtivo: true, vrDiario: 27.32, vaAtivo: false, vaMensal: 0,
    vtAtivo: true, vtValor: 700.00,
    insalubridadeAtiva: true, insalubridadeValor: INSALUBRIDADE_PADRAO,
    status: 'ativo',
    telefone: '11937592097', celular: '11937592097',
    email: '', endereco: 'AV Mendes da Rocha, 1093, AP 18 TORRE B, Jardim Brasil (Zona Norte), São Paulo, SP, 02227-001',
    pix: '38665547886', banco: '', agencia: '', conta: '', observacoes: '',
  },
  {
    id: 'alqui-54', companyId: 'alqui', registro: '54', matriculaEsocial: '',
    name: 'SAMUEL DA COSTA PEREIRA', cpf: '58520946844', rg: '',
    cargo: 'AJUDANTE MECANICO', categoria: 'operacional',
    salarioBase: 2118.78, dataAdmissao: '2025-10-06', dataExameMedico: '2025-10-06',
    vrAtivo: true, vrDiario: 27.32, vaAtivo: false, vaMensal: 0,
    vtAtivo: true, vtValor: 702.00,
    insalubridadeAtiva: true, insalubridadeValor: INSALUBRIDADE_PADRAO,
    status: 'ativo',
    telefone: '11033937610', celular: '11937592097',
    email: '', endereco: 'R Pedro Medeiros, 61, casa 2, Jardim Vila Carrão, São Paulo, SP, 08340-510',
    pix: '58520946844', banco: '', agencia: '', conta: '', observacoes: '',
  },
  {
    id: 'alqui-45', companyId: 'alqui', registro: '45', matriculaEsocial: '',
    name: 'TIAGO MOREIRA DA SILVA FERREIRA', cpf: '10315762586', rg: '2207294684',
    cargo: 'TECNICO MECANICO PLENO', categoria: 'operacional',
    salarioBase: 3024.71, dataAdmissao: '2023-03-01', dataExameMedico: '2025-03-01',
    vrAtivo: true, vrDiario: 27.32, vaAtivo: false, vaMensal: 0,
    vtAtivo: false, vtValor: 0,
    insalubridadeAtiva: true, insalubridadeValor: INSALUBRIDADE_PADRAO,
    status: 'ativo',
    telefone: '11994600000', celular: '11978649057',
    email: '', endereco: 'EST Keiichi Matsumoto, 1505, Prado Rangel, Embu das Artes, SP, 06805-440',
    pix: '10315762586', banco: '', agencia: '', conta: '', observacoes: '',
  },
  {
    id: 'alqui-41', companyId: 'alqui', registro: '41', matriculaEsocial: '',
    name: 'TIAGO TOLEDO DIAS', cpf: '32348689804', rg: '32618241X',
    cargo: 'TECNICO MECANICO PLENO', categoria: 'operacional',
    salarioBase: 3024.71, dataAdmissao: '2022-04-01', dataExameMedico: '2025-04-01',
    vrAtivo: true, vrDiario: 27.32, vaAtivo: false, vaMensal: 0,
    vtAtivo: false, vtValor: 0,
    insalubridadeAtiva: true, insalubridadeValor: INSALUBRIDADE_PADRAO,
    status: 'ativo',
    telefone: '1133937610', celular: '11979166820',
    email: '', endereco: 'R São Januário, 46, Jardim São Miguel, Cotia, SP, 06719-290',
    pix: '32348689804', banco: '', agencia: '', conta: '', observacoes: '',
  },

  // ═══════════════════════════════════════════════════
  // ALQUI OBRAS LTDA — SÓCIOS / PRÓ-LABORE
  // ═══════════════════════════════════════════════════
  {
    id: 'alqui-socio-1', companyId: 'alqui', registro: '', matriculaEsocial: '',
    name: 'ROBSON CHAFI SERVILIO', cpf: '', rg: '',
    cargo: 'Sócio / Pró-labore', categoria: 'socio',
    salarioBase: 4000.00, dataAdmissao: '', dataExameMedico: '',
    vrAtivo: false, vrDiario: 0, vaAtivo: false, vaMensal: 0,
    vtAtivo: false, vtValor: 0,
    insalubridadeAtiva: false, insalubridadeValor: 0,
    status: 'ativo',
    telefone: '', celular: '',
    email: '', endereco: '', pix: '', banco: '', agencia: '', conta: '', observacoes: '',
    inss: 440.00, liquido: 3560.00, referenciaCompetencia: '2026-03',
  },
  {
    id: 'alqui-socio-2', companyId: 'alqui', registro: '', matriculaEsocial: '',
    name: 'AITOR URCELAY ELORZA', cpf: '', rg: '',
    cargo: 'Sócio / Pró-labore', categoria: 'socio',
    salarioBase: 4159.00, dataAdmissao: '', dataExameMedico: '',
    vrAtivo: false, vrDiario: 0, vaAtivo: false, vaMensal: 0,
    vtAtivo: false, vtValor: 0,
    insalubridadeAtiva: false, insalubridadeValor: 0,
    status: 'ativo',
    telefone: '', celular: '',
    email: '', endereco: '', pix: '', banco: '', agencia: '', conta: '', observacoes: '',
    inss: 457.49, liquido: 3701.51, referenciaCompetencia: '2026-03',
  },

  // ═══════════════════════════════════════════════════
  // TOPAC MATRIZ — SÓCIOS / PRÓ-LABORE
  // ═══════════════════════════════════════════════════
  {
    id: 'topac-matriz-socio-1', companyId: 'topac-matriz', registro: '', matriculaEsocial: '',
    name: 'AITOR URCELAY ELORZA', cpf: '', rg: '',
    cargo: 'Sócio / Pró-labore', categoria: 'socio',
    salarioBase: 1621.00, dataAdmissao: '2005-02-24', dataExameMedico: '',
    vrAtivo: false, vrDiario: 0, vaAtivo: false, vaMensal: 0,
    vtAtivo: false, vtValor: 0,
    insalubridadeAtiva: false, insalubridadeValor: 0,
    status: 'ativo',
    telefone: '', celular: '',
    email: '', endereco: '', pix: '', banco: '', agencia: '', conta: '', observacoes: '',
    inss: 178.31, liquido: 1442.69, referenciaCompetencia: '2026-03',
  },
];
