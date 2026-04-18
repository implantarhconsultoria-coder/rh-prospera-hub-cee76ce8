import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { Layers, Plus, X, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

const CentrosCustoPage: React.FC = () => {
  const [centros, setCentros] = useState<any[]>([]);
  const [empresas, setEmpresas] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ codigo: '', nome: '', tipo: 'operacional', empresa_id: '', descricao: '' });

  const carregar = async () => {
    const [c, e] = await Promise.all([
      supabase.from('centros_custo').select('*, empresas(nome)').order('codigo'),
      supabase.from('empresas').select('id, nome'),
    ]);
    setCentros(c.data || []);
    setEmpresas(e.data || []);
  };

  useEffect(() => { carregar(); }, []);

  const salvar = async () => {
    if (!form.codigo || !form.nome) return toast.error('Código e nome são obrigatórios');
    const { error } = await supabase.from('centros_custo').insert({ ...form, empresa_id: form.empresa_id || null });
    if (error) return toast.error(error.message);
    toast.success('Centro de custo criado');
    setShowForm(false);
    setForm({ codigo: '', nome: '', tipo: 'operacional', empresa_id: '', descricao: '' });
    carregar();
  };

  const excluir = async (id: string) => {
    if (!confirm('Excluir centro de custo?')) return;
    const { error } = await supabase.from('centros_custo').delete().eq('id', id);
    if (error) return toast.error('Não pôde excluir');
    carregar();
  };

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-display flex items-center gap-2"><Layers className="w-6 h-6 text-primary" /> Centros de Custo</h1>
          <p className="text-sm text-muted-foreground">{centros.length} centro(s)</p>
        </div>
        <button onClick={() => setShowForm(true)} className="btn-primary flex items-center gap-2"><Plus className="w-4 h-4" /> Novo</button>
      </div>

      <div className="card-premium overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="text-left p-3">Código</th>
              <th className="text-left p-3">Nome</th>
              <th className="text-left p-3">Tipo</th>
              <th className="text-left p-3">Empresa</th>
              <th className="text-center p-3">Ações</th>
            </tr>
          </thead>
          <tbody>
            {centros.map(c => (
              <tr key={c.id} className="border-t border-border">
                <td className="p-3 font-mono">{c.codigo}</td>
                <td className="p-3">{c.nome}</td>
                <td className="p-3 text-xs">{c.tipo}</td>
                <td className="p-3 text-xs">{c.empresas?.nome || '-'}</td>
                <td className="p-3 text-center"><button onClick={() => excluir(c.id)} className="text-destructive p-1"><Trash2 className="w-4 h-4" /></button></td>
              </tr>
            ))}
            {centros.length === 0 && <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">Nenhum centro de custo.</td></tr>}
          </tbody>
        </table>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} className="bg-card rounded-xl shadow-premium-lg w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b border-border">
              <h2 className="text-lg font-bold">Novo Centro de Custo</h2>
              <button onClick={() => setShowForm(false)}><X className="w-5 h-5" /></button>
            </div>
            <div className="p-5 space-y-3">
              <input placeholder="Código *" value={form.codigo} onChange={e => setForm({ ...form, codigo: e.target.value })} className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm" />
              <input placeholder="Nome *" value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm" />
              <select value={form.tipo} onChange={e => setForm({ ...form, tipo: e.target.value })} className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm">
                <option value="operacional">Operacional</option><option value="manutencao">Manutenção</option>
                <option value="administrativo">Administrativo</option><option value="logistica">Logística</option>
                <option value="almoxarifado">Almoxarifado</option><option value="comercial">Comercial</option>
              </select>
              <select value={form.empresa_id} onChange={e => setForm({ ...form, empresa_id: e.target.value })} className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm">
                <option value="">Todas as empresas</option>
                {empresas.map(e => <option key={e.id} value={e.id}>{e.nome}</option>)}
              </select>
              <textarea placeholder="Descrição" value={form.descricao} onChange={e => setForm({ ...form, descricao: e.target.value })} rows={2} className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm" />
              <div className="flex justify-end gap-2"><button onClick={() => setShowForm(false)} className="btn-secondary">Cancelar</button><button onClick={salvar} className="btn-primary">Criar</button></div>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default CentrosCustoPage;
