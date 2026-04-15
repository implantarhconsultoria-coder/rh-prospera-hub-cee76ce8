import React, { useState, useEffect } from 'react';
import { useApp } from '@/context/AppContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Car, Upload, FileText, Trash2, Plus, Search, Eye } from 'lucide-react';
import { toast } from 'sonner';

interface Ativo {
  id: string;
  tipo: string;
  descricao: string;
  placa: string;
  patrimonio: string;
  empresa: string;
  arquivo_url: string;
  observacao: string;
  status: string;
}

const DocumentosVeiculosPage: React.FC = () => {
  const { session } = useApp();
  const [ativos, setAtivos] = useState<Ativo[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);

  // Form state
  const [tipo, setTipo] = useState<'veiculo' | 'compressor'>('veiculo');
  const [descricao, setDescricao] = useState('');
  const [placa, setPlaca] = useState('');
  const [patrimonio, setPatrimonio] = useState('');
  const [empresa, setEmpresa] = useState('TOPAC MATRIZ');
  const [observacao, setObservacao] = useState('');
  const [arquivo, setArquivo] = useState<File | null>(null);

  const fetchAtivos = async () => {
    const { data, error } = await supabase.from('ativos').select('*').order('created_at', { ascending: false });
    if (!error && data) setAtivos(data as Ativo[]);
  };

  useEffect(() => { fetchAtivos(); }, []);

  const handleUpload = async () => {
    if (!descricao) { toast.error('Informe a descrição'); return; }
    if (!session?.user?.id) { toast.error('Faça login primeiro'); return; }
    setLoading(true);
    let arquivo_url = '';
    if (arquivo) {
      const ext = arquivo.name.split('.').pop();
      const path = `${session.user.id}/${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from('documentos-ativos').upload(path, arquivo);
      if (uploadError) { toast.error('Erro no upload: ' + uploadError.message); setLoading(false); return; }
      const { data: urlData } = supabase.storage.from('documentos-ativos').getPublicUrl(path);
      arquivo_url = urlData.publicUrl;
    }
    const { error } = await supabase.from('ativos').insert({
      user_id: session.user.id, tipo, descricao, placa, patrimonio, empresa, observacao, arquivo_url, status: 'ativo',
    } as any);
    if (error) { toast.error('Erro ao salvar: ' + error.message); } else {
      toast.success('Ativo cadastrado!');
      setShowForm(false);
      setDescricao(''); setPlaca(''); setPatrimonio(''); setObservacao(''); setArquivo(null);
      fetchAtivos();
    }
    setLoading(false);
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('ativos').delete().eq('id', id);
    if (!error) { toast.success('Removido'); fetchAtivos(); }
  };

  const filtered = ativos.filter(a =>
    a.descricao.toLowerCase().includes(search.toLowerCase()) ||
    a.placa.toLowerCase().includes(search.toLowerCase()) ||
    a.patrimonio.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="card-premium p-6 gradient-primary text-primary-foreground">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-primary-foreground/20 rounded-2xl flex items-center justify-center">
            <Car className="w-7 h-7" />
          </div>
          <div>
            <h1 className="text-2xl font-bold font-display">Documentos de Veículos e Compressores</h1>
            <p className="text-primary-foreground/70 text-sm">Cadastro e armazenamento de PDFs dos ativos</p>
          </div>
        </div>
      </div>

      <div className="card-premium p-5 space-y-4">
        <div className="flex items-center gap-3">
          <Search className="w-4 h-4 text-muted-foreground" />
          <Input placeholder="Buscar por descrição, placa ou patrimônio..." value={search}
            onChange={e => setSearch(e.target.value)} className="flex-1" />
          <Button size="sm" onClick={() => setShowForm(!showForm)}>
            <Plus className="w-4 h-4 mr-1" />{showForm ? 'Cancelar' : 'Novo Ativo'}
          </Button>
        </div>

        {showForm && (
          <div className="border rounded-lg p-4 space-y-3 bg-muted/20">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              <div><label className="text-xs text-muted-foreground block mb-1">Tipo</label>
                <select value={tipo} onChange={e => setTipo(e.target.value as any)}
                  className="w-full border rounded-lg px-3 py-2 text-sm bg-background text-foreground">
                  <option value="veiculo">Veículo</option>
                  <option value="compressor">Compressor</option>
                </select></div>
              <div><label className="text-xs text-muted-foreground block mb-1">Descrição *</label>
                <Input value={descricao} onChange={e => setDescricao(e.target.value)} /></div>
              <div><label className="text-xs text-muted-foreground block mb-1">Placa</label>
                <Input value={placa} onChange={e => setPlaca(e.target.value)} /></div>
              <div><label className="text-xs text-muted-foreground block mb-1">Patrimônio</label>
                <Input value={patrimonio} onChange={e => setPatrimonio(e.target.value)} /></div>
              <div><label className="text-xs text-muted-foreground block mb-1">Empresa</label>
                <Input value={empresa} onChange={e => setEmpresa(e.target.value)} /></div>
              <div><label className="text-xs text-muted-foreground block mb-1">Observação</label>
                <Input value={observacao} onChange={e => setObservacao(e.target.value)} /></div>
              <div><label className="text-xs text-muted-foreground block mb-1">Arquivo PDF</label>
                <input type="file" accept=".pdf" onChange={e => setArquivo(e.target.files?.[0] || null)}
                  className="text-xs" /></div>
            </div>
            <Button onClick={handleUpload} disabled={loading} className="gradient-accent text-accent-foreground">
              <Upload className="w-4 h-4 mr-2" />{loading ? 'Salvando...' : 'Cadastrar Ativo'}
            </Button>
          </div>
        )}
      </div>

      <div className="card-premium overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="border-b bg-muted/50">
            <th className="px-3 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Tipo</th>
            <th className="px-3 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Descrição</th>
            <th className="px-3 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Placa</th>
            <th className="px-3 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Patrimônio</th>
            <th className="px-3 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Empresa</th>
            <th className="px-3 py-3 text-left text-xs font-medium text-muted-foreground uppercase">PDF</th>
            <th className="px-3 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Ações</th>
          </tr></thead>
          <tbody>
            {filtered.map(a => (
              <tr key={a.id} className="border-b hover:bg-muted/20">
                <td className="px-3 py-2 text-xs capitalize">{a.tipo}</td>
                <td className="px-3 py-2 text-xs font-medium">{a.descricao}</td>
                <td className="px-3 py-2 text-xs">{a.placa || '—'}</td>
                <td className="px-3 py-2 text-xs">{a.patrimonio || '—'}</td>
                <td className="px-3 py-2 text-xs">{a.empresa}</td>
                <td className="px-3 py-2 text-xs">
                  {a.arquivo_url ? <a href={a.arquivo_url} target="_blank" rel="noreferrer" className="text-primary hover:underline flex items-center gap-1"><Eye className="w-3 h-3" />Ver</a> : '—'}
                </td>
                <td className="px-3 py-2">
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDelete(a.id)}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && <tr><td colSpan={7} className="text-center py-8 text-muted-foreground text-sm">Nenhum ativo cadastrado</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default DocumentosVeiculosPage;
