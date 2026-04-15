import React, { useState } from 'react';
import { useApp } from '@/context/AppContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FileCheck, Printer, Search } from 'lucide-react';
import { toast } from 'sonner';

const ProtocoloPage: React.FC = () => {
  const { companies } = useApp();
  const topac = companies.find(c => c.id === 'topac-matriz');

  const [empresaDestinataria, setEmpresaDestinataria] = useState('');
  const [localCanteiro, setLocalCanteiro] = useState('');
  const [responsavelRecebimento, setResponsavelRecebimento] = useState('');
  const [placa, setPlaca] = useState('');
  const [renavam, setRenavam] = useState('');
  const [chassi, setChassi] = useState('');
  const [anoFabricacao, setAnoFabricacao] = useState('');
  const [anoModelo, setAnoModelo] = useState('');
  const [patrimonio, setPatrimonio] = useState('');
  const [exercicio, setExercicio] = useState(new Date().getFullYear().toString());
  const [observacoes, setObservacoes] = useState('');
  const [dataEmissao, setDataEmissao] = useState(new Date().toISOString().slice(0, 10));

  const handlePrint = () => {
    if (!placa && !patrimonio) { toast.error('Informe ao menos placa ou patrimônio'); return; }
    const co = topac;
    const printWin = window.open('', '_blank');
    if (!printWin) return;
    printWin.document.write(`<!DOCTYPE html><html><head><title>Protocolo de Liberação</title>
    <style>@page{size:A4;margin:15mm}body{font-family:Arial,sans-serif;font-size:12px;color:#000}
    .header{display:flex;justify-content:space-between;border-bottom:2px solid #000;padding-bottom:8px;margin-bottom:12px}
    .title{font-size:16px;font-weight:bold;text-align:right}
    .block{border:1px solid #ccc;border-radius:4px;padding:10px;margin-bottom:12px}
    .block-title{font-weight:bold;font-size:11px;text-transform:uppercase;color:#555;margin-bottom:6px}
    .grid{display:grid;grid-template-columns:1fr 1fr;gap:4px 16px}
    .field{font-size:11px}.field span{color:#666}
    .signatures{display:flex;justify-content:space-between;margin-top:60px}
    .sig-line{text-align:center;width:45%}.sig-line hr{border:0;border-top:1px solid #000;margin-bottom:4px}
    .footer{margin-top:30px;text-align:center;font-size:9px;color:#999;border-top:1px solid #eee;padding-top:6px}
    </style></head><body>
    <div class="header"><div><strong>${co?.name || 'TOPAC MATRIZ'}</strong><br/><span style="font-size:10px">CNPJ: ${co?.cnpj || ''}</span></div>
    <div class="title">PROTOCOLO DE<br/>LIBERAÇÃO DE DOCUMENTO</div></div>
    <div class="block"><div class="block-title">Dados da Liberação</div>
    <div class="grid">
    <div class="field"><span>Empresa Destinatária:</span> ${empresaDestinataria}</div>
    <div class="field"><span>Local/Canteiro:</span> ${localCanteiro || '—'}</div>
    <div class="field"><span>Responsável Recebimento:</span> ${responsavelRecebimento}</div>
    <div class="field"><span>Data:</span> ${new Date(dataEmissao).toLocaleDateString('pt-BR')}</div>
    </div></div>
    <div class="block"><div class="block-title">Identificação do Ativo</div>
    <div class="grid">
    <div class="field"><span>Placa:</span> ${placa || '—'}</div>
    <div class="field"><span>Renavam:</span> ${renavam || '—'}</div>
    <div class="field"><span>Chassi:</span> ${chassi || '—'}</div>
    <div class="field"><span>Ano Fabricação:</span> ${anoFabricacao || '—'}</div>
    <div class="field"><span>Ano Modelo:</span> ${anoModelo || '—'}</div>
    <div class="field"><span>Patrimônio:</span> ${patrimonio || '—'}</div>
    <div class="field"><span>Exercício:</span> ${exercicio}</div>
    </div></div>
    ${observacoes ? `<div class="block"><div class="block-title">Observações</div><p style="font-size:11px">${observacoes}</p></div>` : ''}
    <div class="signatures">
    <div class="sig-line"><hr/><small>Assinatura — Entrega</small></div>
    <div class="sig-line"><hr/><small>Assinatura — Recebimento</small></div>
    </div>
    <div class="footer">Topac RH Multiempresa PRO — Documento gerado em ${new Date().toLocaleDateString('pt-BR')}</div>
    </body></html>`);
    printWin.document.close();
    printWin.print();
    toast.success('Protocolo gerado!');
  };

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="card-premium p-6 gradient-primary text-primary-foreground">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-primary-foreground/20 rounded-2xl flex items-center justify-center">
            <FileCheck className="w-7 h-7" />
          </div>
          <div>
            <h1 className="text-2xl font-bold font-display">Protocolo / Liberação de Documento</h1>
            <p className="text-primary-foreground/70 text-sm">Empresa padrão: TOPAC MATRIZ</p>
          </div>
        </div>
      </div>

      <div className="card-premium p-5 space-y-4">
        <h2 className="text-sm font-bold text-foreground">Dados da Liberação</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div><label className="text-xs text-muted-foreground block mb-1">Empresa Destinatária</label>
            <Input value={empresaDestinataria} onChange={e => setEmpresaDestinataria(e.target.value)} /></div>
          <div><label className="text-xs text-muted-foreground block mb-1">Local / Canteiro</label>
            <Input value={localCanteiro} onChange={e => setLocalCanteiro(e.target.value)} /></div>
          <div><label className="text-xs text-muted-foreground block mb-1">Responsável pelo Recebimento</label>
            <Input value={responsavelRecebimento} onChange={e => setResponsavelRecebimento(e.target.value)} /></div>
          <div><label className="text-xs text-muted-foreground block mb-1">Data de Emissão</label>
            <Input type="date" value={dataEmissao} onChange={e => setDataEmissao(e.target.value)} /></div>
        </div>
      </div>

      <div className="card-premium p-5 space-y-4">
        <h2 className="text-sm font-bold text-foreground">Identificação do Ativo</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div><label className="text-xs text-muted-foreground block mb-1">Placa</label>
            <Input value={placa} onChange={e => setPlaca(e.target.value)} /></div>
          <div><label className="text-xs text-muted-foreground block mb-1">Renavam</label>
            <Input value={renavam} onChange={e => setRenavam(e.target.value)} /></div>
          <div><label className="text-xs text-muted-foreground block mb-1">Chassi</label>
            <Input value={chassi} onChange={e => setChassi(e.target.value)} /></div>
          <div><label className="text-xs text-muted-foreground block mb-1">Ano Fabricação</label>
            <Input value={anoFabricacao} onChange={e => setAnoFabricacao(e.target.value)} /></div>
          <div><label className="text-xs text-muted-foreground block mb-1">Ano Modelo</label>
            <Input value={anoModelo} onChange={e => setAnoModelo(e.target.value)} /></div>
          <div><label className="text-xs text-muted-foreground block mb-1">Patrimônio</label>
            <Input value={patrimonio} onChange={e => setPatrimonio(e.target.value)} /></div>
          <div><label className="text-xs text-muted-foreground block mb-1">Exercício</label>
            <Input value={exercicio} onChange={e => setExercicio(e.target.value)} /></div>
        </div>
      </div>

      <div className="card-premium p-5 space-y-4">
        <label className="text-xs text-muted-foreground">Observações</label>
        <textarea value={observacoes} onChange={e => setObservacoes(e.target.value)}
          className="w-full border rounded-lg px-3 py-2 text-sm bg-background text-foreground min-h-[60px]" />
        <Button onClick={handlePrint} className="gradient-accent text-accent-foreground font-semibold">
          <Printer className="w-4 h-4 mr-2" /> Gerar e Imprimir Protocolo
        </Button>
      </div>
    </div>
  );
};

export default ProtocoloPage;
