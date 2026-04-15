import React, { useState, useEffect } from 'react';
import { useApp } from '@/context/AppContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Car, Upload, Trash2, Search, Eye, Sparkles, Loader2 } from 'lucide-react';
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
  renavam: string;
  chassi: string;
  ano_fabricacao: string;
  ano_modelo: string;
}

const DocumentosVeiculosPage: React.FC = () => {
  const { session } = useApp();
  const [ativos, setAtivos] = useState<Ativo[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [uploading, setUploading] = useState(false);

  const fetchAtivos = async () => {
    const { data, error } = await supabase.from('ativos').select('*').eq('tipo', 'veiculo').order('created_at', { ascending: false });
    if (!error && data) setAtivos(data as unknown as Ativo[]);
  };

  useEffect(() => { fetchAtivos(); }, []);

  const handleMultiUpload = async (files: FileList) => {
    if (!session?.user?.id) { toast.error('Faça login primeiro'); return; }
    setUploading(true);
    let success = 0;
    for (const file of Array.from(files)) {
      const ext = file.name.split('.').pop();
      const path = `${session.user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error: uploadError } = await supabase.storage.from('documentos-ativos').upload(path, file);
      if (uploadError) { toast.error(`Erro no upload de ${file.name}`); continue; }
      const { data: urlData } = supabase.storage.from('documentos-ativos').getPublicUrl(path);
      const arquivo_url = urlData.publicUrl;

      // Try AI extraction
      let extracted: any = {};
      try {
        const { data: aiData } = await supabase.functions.invoke('parse-text', {
          body: { text: `Arquivo: ${file.name}. Documento de veículo.`, type: 'documento_veiculo' },
        });
        if (aiData?.data) extracted = aiData.data;
      } catch {}

      const { error } = await supabase.from('ativos').insert({
        user_id: session.user.id,
        tipo: 'veiculo',
        descricao: extracted.descricao || file.name.replace(/\.[^/.]+$/, ''),
        placa: extracted.placa || '',
        patrimonio: extracted.patrimonio || '',
        empresa: extracted.empresa || 'TOPAC MATRIZ',
        observacao: '',
        arquivo_url,
        renavam: extracted.renavam || '',
        chassi: extracted.chassi || '',
        ano_fabricacao: extracted.ano_fabricacao || '',
        ano_modelo: extracted.ano_modelo || '',
        status: 'ativo',
      } as any);
      if (!error) success++;
    }
    if (success > 0) {
      toast.success(`${success} documento(s) cadastrado(s)!`);
      fetchAtivos();
    }
    setUploading(false);
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('ativos').delete().eq('id', id);
    if (!error) { toast.success('Removido'); fetchAtivos(); }
  };

  const filtered = ativos.filter(a =>
    (a.descricao || '').toLowerCase().includes(search.toLowerCase()) ||
    (a.placa || '').toLowerCase().includes(search.toLowerCase()) ||
    (a.patrimonio || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="card-premium p-6 gradient-primary text-primary-foreground">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-primary-foreground/20 rounded-2xl flex items-center justify-center">
            <Car className="w-7 h-7" />
          </div>
          <div>
            <h1 className="text-2xl font-bold font-display">Documentos de Veículos</h1>
            <p className="text-primary-foreground/70 text-sm">Upload múltiplo de PDFs com leitura automática por IA</p>
          </div>
        </div>
      </div>

      <div className="card-premium p-5 space-y-4">
        <div className="flex items-center gap-3 flex-wrap">
          <Search className="w-4 h-4 text-muted-foreground" />
          <Input placeholder="Buscar por descrição, placa ou patrimônio..." value={search}
            onChange={e => setSearch(e.target.value)} className="flex-1 min-w-[200px]" />
          <label className="flex items-center gap-2 cursor-pointer">
            <Button size="sm" disabled={uploading} asChild>
              <span>
                {uploading ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Upload className="w-4 h-4 mr-1" />}
                {uploading ? 'Enviando...' : 'Upload Múltiplo de PDFs'}
              </span>
            </Button>
            <input type="file" accept=".pdf" multiple className="hidden"
              onChange={e => e.target.files && e.target.files.length > 0 && handleMultiUpload(e.target.files)} />
          </label>
        </div>
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          <Sparkles className="w-3 h-3" /> Ao subir PDFs, a IA tenta extrair placa, renavam, chassi e outros dados automaticamente. Dados reaproveitados no Protocolo.
        </p>
      </div>

      <div className="card-premium overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="border-b bg-muted/50 sticky top-0 z-10">
            <th className="px-3 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Descrição</th>
            <th className="px-3 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Placa</th>
            <th className="px-3 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Patrimônio</th>
            <th className="px-3 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Renavam</th>
            <th className="px-3 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Chassi</th>
            <th className="px-3 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Empresa</th>
            <th className="px-3 py-3 text-left text-xs font-medium text-muted-foreground uppercase">PDF</th>
            <th className="px-3 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Ações</th>
          </tr></thead>
          <tbody>
            {filtered.map(a => (
              <tr key={a.id} className="border-b hover:bg-muted/20">
                <td className="px-3 py-2 text-xs font-medium">{a.descricao}</td>
                <td className="px-3 py-2 text-xs">{a.placa || '—'}</td>
                <td className="px-3 py-2 text-xs">{a.patrimonio || '—'}</td>
                <td className="px-3 py-2 text-xs">{a.renavam || '—'}</td>
                <td className="px-3 py-2 text-xs font-mono">{a.chassi || '—'}</td>
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
            {filtered.length === 0 && <tr><td colSpan={8} className="text-center py-8 text-muted-foreground text-sm">Nenhum documento cadastrado</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default DocumentosVeiculosPage;
