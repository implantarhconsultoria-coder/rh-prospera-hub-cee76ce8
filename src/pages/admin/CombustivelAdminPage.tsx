import React, { useEffect, useState } from 'react';
import { Fuel, Plus, QrCode, CheckCircle2, AlertTriangle, Filter as FilterIcon } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';

interface Vale { id: string; codigo: string; valor_limite: number; litros_limite: number; status: string; validade: string | null; veiculo_id: string | null; created_at: string; }
interface Abast { id: string; mecanico_nome: string; placa: string; valor: number; litros: number; status: string; foto_bomba_url: string; data: string; hora: string; competencia: string; vale_codigo: string; observacao_conferencia: string; }
interface Veic { id: string; placa: string; modelo: string; }

const genCodigo = () => 'VL-' + Math.random().toString(36).slice(2, 8).toUpperCase() + '-' + Date.now().toString(36).slice(-4).toUpperCase();

const CombustivelAdminPage: React.FC = () => {
  const [vales, setVales] = useState<Vale[]>([]);
  const [abast, setAbast] = useState<Abast[]>([]);
  const [veiculos, setVeiculos] = useState<Veic[]>([]);
  const [openVale, setOpenVale] = useState(false);
  const [openConf, setOpenConf] = useState<Abast | null>(null);
  const [filterStatus, setFilterStatus] = useState('todos');
  const [obs, setObs] = useState('');
  const [novoVale, setNovoVale] = useState({ veiculo_id: '', valor_limite: '300', litros_limite: '60', validade: '' });

  const reload = async () => {
    const [v, a, ve] = await Promise.all([
      supabase.from('vales_combustivel').select('*').order('created_at', { ascending: false }).limit(50),
      supabase.from('abastecimentos').select('*').order('created_at', { ascending: false }).limit(100),
      supabase.from('veiculos').select('id, placa, modelo').order('placa'),
    ]);
    setVales((v.data as any) || []);
    setAbast((a.data as any) || []);
    setVeiculos((ve.data as any) || []);
  };

  useEffect(() => { reload(); }, []);

  const criarVale = async () => {
    const codigo = genCodigo();
    const { error } = await supabase.from('vales_combustivel').insert({
      codigo,
      veiculo_id: novoVale.veiculo_id || null,
      valor_limite: Number(novoVale.valor_limite) || 0,
      litros_limite: Number(novoVale.litros_limite) || 0,
      validade: novoVale.validade || null,
    } as any);
    if (error) return toast.error(error.message);
    toast.success(`Vale ${codigo} criado`);
    setOpenVale(false);
    reload();
  };

  const conferir = async (status: 'conferido' | 'divergente') => {
    if (!openConf) return;
    const { error } = await supabase.from('abastecimentos').update({
      status, observacao_conferencia: obs, conferido_em: new Date().toISOString(),
    } as any).eq('id', openConf.id);
    if (error) return toast.error(error.message);
    toast.success(status === 'conferido' ? 'Conferido' : 'Marcado como divergente');
    setOpenConf(null); setObs(''); reload();
  };

  const filtered = abast.filter(a => filterStatus === 'todos' || a.status === filterStatus);
  const totalValor = filtered.reduce((s, a) => s + Number(a.valor), 0);
  const totalLitros = filtered.reduce((s, a) => s + Number(a.litros), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Fuel className="w-6 h-6 text-primary" /> Combustível</h1>
          <p className="text-sm text-muted-foreground">Vales (QR Code), abastecimentos e conferência</p>
        </div>
        <Button onClick={() => setOpenVale(true)}><Plus className="w-4 h-4 mr-2" /> Gerar vale</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <Card className="p-4"><p className="text-xs text-muted-foreground">Vales ativos</p><p className="text-2xl font-bold">{vales.filter(v => v.status === 'ativo').length}</p></Card>
        <Card className="p-4"><p className="text-xs text-muted-foreground">Abastecimentos ({filterStatus})</p><p className="text-2xl font-bold">{filtered.length}</p></Card>
        <Card className="p-4"><p className="text-xs text-muted-foreground">Total R$</p><p className="text-2xl font-bold">R$ {totalValor.toFixed(2)}</p></Card>
        <Card className="p-4"><p className="text-xs text-muted-foreground">Total litros</p><p className="text-2xl font-bold">{totalLitros.toFixed(2)} L</p></Card>
      </div>

      <Card className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold flex items-center gap-2"><QrCode className="w-4 h-4" /> Vales emitidos</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs text-muted-foreground border-b"><th className="py-2">Código</th><th>Veículo</th><th>Limite R$</th><th>Litros</th><th>Validade</th><th>Status</th></tr></thead>
            <tbody>
              {vales.map(v => {
                const ve = veiculos.find(x => x.id === v.veiculo_id);
                return (<tr key={v.id} className="border-b last:border-0"><td className="py-2 font-mono text-xs">{v.codigo}</td><td>{ve ? `${ve.placa} - ${ve.modelo}` : '—'}</td><td>R$ {Number(v.valor_limite).toFixed(2)}</td><td>{v.litros_limite} L</td><td>{v.validade || '—'}</td><td><span className={`text-[10px] font-bold uppercase px-2 py-1 rounded-full ${v.status === 'ativo' ? 'bg-emerald-500/15 text-emerald-700' : 'bg-muted text-muted-foreground'}`}>{v.status}</span></td></tr>);
              })}
              {vales.length === 0 && <tr><td colSpan={6} className="py-6 text-center text-muted-foreground">Nenhum vale</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="p-4">
        <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
          <h2 className="font-bold">Abastecimentos</h2>
          <div className="flex items-center gap-2">
            <FilterIcon className="w-4 h-4 text-muted-foreground" />
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="pendente">Pendente</SelectItem>
                <SelectItem value="conferido">Conferido</SelectItem>
                <SelectItem value="divergente">Divergente</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs text-muted-foreground border-b"><th className="py-2">Data</th><th>Mecânico</th><th>Placa</th><th>Vale</th><th>R$</th><th>Litros</th><th>Foto</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {filtered.map(a => (
                <tr key={a.id} className="border-b last:border-0">
                  <td className="py-2">{a.data} {a.hora?.slice(0, 5)}</td>
                  <td>{a.mecanico_nome}</td>
                  <td>{a.placa}</td>
                  <td className="font-mono text-xs">{a.vale_codigo}</td>
                  <td>R$ {Number(a.valor).toFixed(2)}</td>
                  <td>{Number(a.litros).toFixed(2)}</td>
                  <td>{a.foto_bomba_url && <a href={a.foto_bomba_url} target="_blank" rel="noreferrer"><img src={a.foto_bomba_url} className="w-10 h-10 object-cover rounded" alt="bomba" /></a>}</td>
                  <td><span className={`text-[10px] font-bold uppercase px-2 py-1 rounded-full ${a.status === 'conferido' ? 'bg-emerald-500/15 text-emerald-700' : a.status === 'divergente' ? 'bg-rose-500/15 text-rose-700' : 'bg-amber-500/15 text-amber-700'}`}>{a.status}</span></td>
                  <td><Button size="sm" variant="outline" onClick={() => { setOpenConf(a); setObs(a.observacao_conferencia || ''); }}>Conferir</Button></td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={9} className="py-6 text-center text-muted-foreground">Nenhum abastecimento</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>

      <Dialog open={openVale} onOpenChange={setOpenVale}>
        <DialogContent>
          <DialogHeader><DialogTitle>Gerar vale de combustível</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Veículo</Label>
              <Select value={novoVale.veiculo_id} onValueChange={(v) => setNovoVale({ ...novoVale, veiculo_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>{veiculos.map(v => <SelectItem key={v.id} value={v.id}>{v.placa} - {v.modelo}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Limite R$</Label><Input value={novoVale.valor_limite} onChange={e => setNovoVale({ ...novoVale, valor_limite: e.target.value })} /></div>
              <div><Label>Limite litros</Label><Input value={novoVale.litros_limite} onChange={e => setNovoVale({ ...novoVale, litros_limite: e.target.value })} /></div>
            </div>
            <div><Label>Validade</Label><Input type="date" value={novoVale.validade} onChange={e => setNovoVale({ ...novoVale, validade: e.target.value })} /></div>
          </div>
          <DialogFooter><Button onClick={criarVale}>Criar vale</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!openConf} onOpenChange={(o) => !o && setOpenConf(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Conferir abastecimento</DialogTitle></DialogHeader>
          {openConf && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div><span className="text-muted-foreground">Mecânico:</span> {openConf.mecanico_nome}</div>
                <div><span className="text-muted-foreground">Placa:</span> {openConf.placa}</div>
                <div><span className="text-muted-foreground">Valor:</span> R$ {Number(openConf.valor).toFixed(2)}</div>
                <div><span className="text-muted-foreground">Litros:</span> {Number(openConf.litros).toFixed(2)}</div>
                <div className="col-span-2"><span className="text-muted-foreground">Vale:</span> {openConf.vale_codigo}</div>
              </div>
              {openConf.foto_bomba_url && <img src={openConf.foto_bomba_url} className="w-full max-h-64 object-cover rounded border" alt="bomba" />}
              <Textarea value={obs} onChange={e => setObs(e.target.value)} placeholder="Observação da conferência" />
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => conferir('divergente')}><AlertTriangle className="w-4 h-4 mr-2" /> Divergente</Button>
            <Button onClick={() => conferir('conferido')}><CheckCircle2 className="w-4 h-4 mr-2" /> Conferido</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CombustivelAdminPage;
