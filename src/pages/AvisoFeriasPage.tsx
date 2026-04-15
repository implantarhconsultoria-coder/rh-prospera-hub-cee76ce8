import React, { useState } from 'react';
import { useApp } from '@/context/AppContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CalendarCheck, Printer, Search, Save } from 'lucide-react';
import { formatDate } from '@/lib/calculations';
import { toast } from 'sonner';

const AvisoFeriasPage: React.FC = () => {
  const { companies, employees, updateEmployee } = useApp();
  const [search, setSearch] = useState('');
  const [selectedEmpId, setSelectedEmpId] = useState('');
  const [inicioFerias, setInicioFerias] = useState('');
  const [diasFerias, setDiasFerias] = useState(30);

  const filteredEmps = employees.filter(e =>
    e.status === 'ativo' && e.categoria === 'operacional' &&
    (e.name.toLowerCase().includes(search.toLowerCase()) ||
     e.cpf.includes(search) || e.cargo.toLowerCase().includes(search.toLowerCase()))
  );

  const emp = employees.find(e => e.id === selectedEmpId);
  const company = emp ? companies.find(c => c.id === emp.companyId) : null;

  const calcRetorno = () => {
    if (!inicioFerias) return '';
    const d = new Date(inicioFerias);
    d.setDate(d.getDate() + diasFerias);
    return d.toISOString().slice(0, 10);
  };

  const retorno = calcRetorno();

  const handleSaveDate = () => {
    if (!emp || !inicioFerias) { toast.error('Selecione funcionário e data'); return; }
    updateEmployee(emp.id, { observacoes: `${emp.observacoes}\n[FÉRIAS] Início previsto: ${inicioFerias} | Retorno: ${retorno} | ${diasFerias} dias`.trim() });
    toast.success('Data de férias salva no cadastro!');
  };

  const handlePrint = () => {
    if (!emp || !inicioFerias) { toast.error('Preencha os dados'); return; }
    const co = company;
    const printWin = window.open('', '_blank');
    if (!printWin) return;
    printWin.document.write(`<!DOCTYPE html><html><head><title>Aviso de Férias</title>
    <style>@page{size:A4;margin:15mm}body{font-family:Arial,sans-serif;font-size:12px;color:#000}
    .header{display:flex;justify-content:space-between;border-bottom:2px solid #000;padding-bottom:8px;margin-bottom:16px}
    .title{font-size:18px;font-weight:bold;text-align:right}
    .block{border:1px solid #ccc;border-radius:4px;padding:12px;margin-bottom:14px}
    .block-title{font-weight:bold;font-size:11px;text-transform:uppercase;color:#555;margin-bottom:8px}
    .grid{display:grid;grid-template-columns:1fr 1fr;gap:6px 16px}
    .field{font-size:11px}.field span{color:#666}
    .comunicacao{border:1px solid #ccc;border-radius:4px;padding:14px;margin-bottom:14px;font-size:11px;line-height:1.6}
    .signatures{display:flex;justify-content:space-between;margin-top:50px}
    .sig-line{text-align:center;width:45%}.sig-line hr{border:0;border-top:1px solid #000;margin-bottom:4px}
    .footer{margin-top:30px;text-align:center;font-size:9px;color:#999;border-top:1px solid #eee;padding-top:6px}
    </style></head><body>
    <div class="header"><div><strong>${co?.name || ''}</strong><br/><span style="font-size:10px">CNPJ: ${co?.cnpj || ''}</span></div>
    <div class="title">AVISO DE<br/>FÉRIAS</div></div>
    <div class="block"><div class="block-title">Dados do Colaborador</div>
    <div class="grid">
    <div class="field"><span>Nome:</span> ${emp.name}</div>
    <div class="field"><span>Função:</span> ${emp.cargo}</div>
    <div class="field"><span>CPF:</span> ${emp.cpf}</div>
    <div class="field"><span>RG:</span> ${emp.rg || '—'}</div>
    <div class="field"><span>Matrícula:</span> ${emp.registro || '—'}</div>
    <div class="field"><span>Empresa:</span> ${co?.name || ''}</div>
    <div class="field"><span>Admissão:</span> ${emp.dataAdmissao ? new Date(emp.dataAdmissao).toLocaleDateString('pt-BR') : '—'}</div>
    </div></div>
    <div class="comunicacao">
    <strong>COMUNICAÇÃO DE FÉRIAS</strong><br/><br/>
    Comunicamos que o(a) colaborador(a) acima identificado(a) gozará férias de <strong>${diasFerias} dias</strong>,
    com início em <strong>${new Date(inicioFerias).toLocaleDateString('pt-BR')}</strong>
    e retorno em <strong>${retorno ? new Date(retorno).toLocaleDateString('pt-BR') : '—'}</strong>.<br/><br/>
    Data de emissão: ${new Date().toLocaleDateString('pt-BR')}
    </div>
    <div class="signatures">
    <div class="sig-line"><hr/><small>Assinatura do Colaborador</small></div>
    <div class="sig-line"><hr/><small>Assinatura do Responsável</small></div>
    </div>
    <div class="footer">Topac RH Multiempresa PRO — Documento gerado em ${new Date().toLocaleDateString('pt-BR')}</div>
    </body></html>`);
    printWin.document.close();
    printWin.print();
    toast.success('Aviso de férias gerado!');
  };

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="card-premium p-6 gradient-primary text-primary-foreground">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-primary-foreground/20 rounded-2xl flex items-center justify-center">
            <CalendarCheck className="w-7 h-7" />
          </div>
          <div>
            <h1 className="text-2xl font-bold font-display">Aviso de Férias</h1>
            <p className="text-primary-foreground/70 text-sm">Gerar aviso de férias para impressão</p>
          </div>
        </div>
      </div>

      <div className="card-premium p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Search className="w-4 h-4 text-muted-foreground" />
          <Input placeholder="Buscar funcionário..." value={search}
            onChange={e => setSearch(e.target.value)} className="flex-1" />
        </div>
        {search && !selectedEmpId && (
          <div className="border rounded-lg max-h-48 overflow-y-auto">
            {filteredEmps.map(e => {
              const co = companies.find(c => c.id === e.companyId);
              return (
                <button key={e.id} onClick={() => { setSelectedEmpId(e.id); setSearch(''); }}
                  className="w-full text-left px-3 py-2 hover:bg-muted/50 text-sm flex justify-between items-center border-b last:border-0">
                  <span className="font-medium">{e.name}</span>
                  <span className="text-xs text-muted-foreground">{co?.name} — {e.cargo}</span>
                </button>
              );
            })}
          </div>
        )}
        {emp && company && (
          <div className="bg-muted/30 rounded-lg p-4 grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <div><span className="text-muted-foreground text-xs block">Nome</span><strong>{emp.name}</strong></div>
            <div><span className="text-muted-foreground text-xs block">Empresa</span>{company.name}</div>
            <div><span className="text-muted-foreground text-xs block">Função</span>{emp.cargo}</div>
            <div><span className="text-muted-foreground text-xs block">Admissão</span>{formatDate(emp.dataAdmissao)}</div>
            <div className="flex items-end">
              <Button variant="ghost" size="sm" onClick={() => setSelectedEmpId('')} className="text-xs text-destructive">Trocar</Button>
            </div>
          </div>
        )}
      </div>

      {emp && (
        <div className="card-premium p-5 space-y-4">
          <h2 className="text-sm font-bold text-foreground">Dados das Férias</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div><label className="text-xs text-muted-foreground block mb-1">Início das Férias</label>
              <Input type="date" value={inicioFerias} onChange={e => setInicioFerias(e.target.value)} /></div>
            <div><label className="text-xs text-muted-foreground block mb-1">Dias de Férias</label>
              <select value={diasFerias} onChange={e => setDiasFerias(Number(e.target.value))}
                className="w-full border rounded-lg px-3 py-2 text-sm bg-background text-foreground">
                <option value={30}>30 dias</option>
                <option value={20}>20 dias</option>
                <option value={15}>15 dias</option>
                <option value={10}>10 dias</option>
              </select></div>
            <div><label className="text-xs text-muted-foreground block mb-1">Retorno Previsto</label>
              <p className="text-sm font-medium bg-muted/50 px-3 py-2 rounded-md">{retorno ? formatDate(retorno) : '—'}</p></div>
          </div>
          <div className="flex gap-3 flex-wrap">
            <Button onClick={handleSaveDate} variant="outline">
              <Save className="w-4 h-4 mr-2" /> Salvar Data no Cadastro
            </Button>
            <Button onClick={handlePrint} className="gradient-accent text-accent-foreground font-semibold">
              <Printer className="w-4 h-4 mr-2" /> Gerar e Imprimir Aviso
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AvisoFeriasPage;
