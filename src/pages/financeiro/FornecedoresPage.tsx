import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { Truck, Plus, X, Search, Edit2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

const FornecedoresPage: React.FC = () => {
  const [fornecedores, setFornecedores] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  const empty = {
    razao_social: '', nome_fantasia: '', cnpj_cpf: '', email: '', telefone: '',
    contato_responsavel: '', endereco: '', cidade: '', uf: '', cep: '',
    banco: '', agencia: '', conta: '', tipo_conta: 'corrente', pix: '',
    categoria: 'geral', observacoes: '',
  };
  const [form, setForm] = useState<any>(empty);

  const carregar = async () => {
    setLoading(true);
    const { data } = await supabase.from('fornecedores').select('*').order('razao_social');
    setFornecedores(data || []);
    setLoading(false);
  };

  useEffect(() => { carregar(); }, []);

  const salvar = async () => {
    if (!form.razao_social) return toast.error('Razão social é obrigatória');
    const payload = { ...form };
    if (editing) {
      await supabase.from('fornecedores').update(payload).eq('id', editing.id);
      toast.success('Fornecedor atualizado');
    } else {
      await supabase.from('fornecedores').insert(payload);
      toast.success('Fornecedor criado');
    }
    setShowForm(false); setEditing(null); setForm(empty); carregar();
  };

  const excluir = async (id: string) => {
    if (!confirm('Excluir este fornecedor?')) return;
    const { error } = await supabase.from('fornecedores').delete().eq('id', id);
    if (error) return toast.error('Não foi possível excluir (pode ter títulos vinculados)');
    toast.success('Excluído');
    carregar();
  };

  const editar = (f: any) => { setEditing(f); setForm(f); setShowForm(true); };

  const filtered = fornecedores.filter(f =>
    !search || `${f.razao_social} ${f.nome_fantasia} ${f.cnpj_cpf}`.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-display flex items-center gap-2"><Truck className="w-6 h-6 text-primary" /> Fornecedores</h1>
          <p className="text-sm text-muted-foreground">{filtered.length} fornecedor(es)</p>
        </div>
        <button onClick={() => { setEditing(null); setForm(empty); setShowForm(true); }} className="btn-primary flex items-center gap-2"><Plus className="w-4 h-4" /> Novo</button>
      </div>

      <div className="card-premium p-3 flex items-center gap-2">
        <Search className="w-4 h-4 text-muted-foreground" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar..." className="bg-transparent flex-1 outline-none text-sm" />
      </div>

      {loading ? <p className="text-center p-8 text-muted-foreground">Carregando...</p> : (
        <div className="card-premium overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="text-left p-3">Razão Social</th>
                <th className="text-left p-3">CNPJ/CPF</th>
                <th className="text-left p-3">Categoria</th>
                <th className="text-left p-3">Contato</th>
                <th className="text-center p-3">Status</th>
                <th className="text-center p-3">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(f => (
                <tr key={f.id} className="border-t border-border hover:bg-sidebar-accent/10">
                  <td className="p-3"><div className="font-medium">{f.razao_social}</div><div className="text-xs text-muted-foreground">{f.nome_fantasia}</div></td>
                  <td className="p-3 font-mono text-xs">{f.cnpj_cpf || '-'}</td>
                  <td className="p-3 text-xs">{f.categoria}</td>
                  <td className="p-3 text-xs">{f.email || f.telefone || '-'}</td>
                  <td className="p-3 text-center"><span className={`text-[10px] px-2 py-1 rounded-full ${f.status === 'ativo' ? 'bg-success/20 text-success' : 'bg-muted'}`}>{f.status}</span></td>
                  <td className="p-3 text-center space-x-1">
                    <button onClick={() => editar(f)} className="p-1 hover:bg-primary/20 rounded text-primary"><Edit2 className="w-4 h-4" /></button>
                    <button onClick={() => excluir(f.id)} className="p-1 hover:bg-destructive/20 rounded text-destructive"><Trash2 className="w-4 h-4" /></button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">Nenhum fornecedor.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} className="bg-card rounded-xl shadow-premium-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-border">
              <h2 className="text-lg font-bold font-display">{editing ? 'Editar' : 'Novo'} Fornecedor</h2>
              <button onClick={() => { setShowForm(false); setEditing(null); }}><X className="w-5 h-5" /></button>
            </div>
            <div className="p-5 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <input placeholder="Razão Social *" value={form.razao_social} onChange={e => setForm({ ...form, razao_social: e.target.value })} className="bg-background border border-border rounded-md px-3 py-2 text-sm" />
                <input placeholder="Nome Fantasia" value={form.nome_fantasia} onChange={e => setForm({ ...form, nome_fantasia: e.target.value })} className="bg-background border border-border rounded-md px-3 py-2 text-sm" />
                <input placeholder="CNPJ/CPF" value={form.cnpj_cpf} onChange={e => setForm({ ...form, cnpj_cpf: e.target.value })} className="bg-background border border-border rounded-md px-3 py-2 text-sm" />
                <input placeholder="Categoria" value={form.categoria} onChange={e => setForm({ ...form, categoria: e.target.value })} className="bg-background border border-border rounded-md px-3 py-2 text-sm" />
                <input placeholder="Email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className="bg-background border border-border rounded-md px-3 py-2 text-sm" />
                <input placeholder="Telefone" value={form.telefone} onChange={e => setForm({ ...form, telefone: e.target.value })} className="bg-background border border-border rounded-md px-3 py-2 text-sm" />
                <input placeholder="Contato" value={form.contato_responsavel} onChange={e => setForm({ ...form, contato_responsavel: e.target.value })} className="bg-background border border-border rounded-md px-3 py-2 text-sm col-span-2" />
                <input placeholder="Endereço" value={form.endereco} onChange={e => setForm({ ...form, endereco: e.target.value })} className="bg-background border border-border rounded-md px-3 py-2 text-sm col-span-2" />
                <input placeholder="Cidade" value={form.cidade} onChange={e => setForm({ ...form, cidade: e.target.value })} className="bg-background border border-border rounded-md px-3 py-2 text-sm" />
                <input placeholder="UF" maxLength={2} value={form.uf} onChange={e => setForm({ ...form, uf: e.target.value.toUpperCase() })} className="bg-background border border-border rounded-md px-3 py-2 text-sm" />
              </div>
              <div className="border-t border-border pt-3">
                <p className="text-xs uppercase text-muted-foreground mb-2">Dados Bancários</p>
                <div className="grid grid-cols-2 gap-3">
                  <input placeholder="Banco" value={form.banco} onChange={e => setForm({ ...form, banco: e.target.value })} className="bg-background border border-border rounded-md px-3 py-2 text-sm" />
                  <input placeholder="Agência" value={form.agencia} onChange={e => setForm({ ...form, agencia: e.target.value })} className="bg-background border border-border rounded-md px-3 py-2 text-sm" />
                  <input placeholder="Conta" value={form.conta} onChange={e => setForm({ ...form, conta: e.target.value })} className="bg-background border border-border rounded-md px-3 py-2 text-sm" />
                  <input placeholder="PIX" value={form.pix} onChange={e => setForm({ ...form, pix: e.target.value })} className="bg-background border border-border rounded-md px-3 py-2 text-sm" />
                </div>
              </div>
              <textarea placeholder="Observações" value={form.observacoes} onChange={e => setForm({ ...form, observacoes: e.target.value })} rows={2} className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm" />
              <div className="flex justify-end gap-2 pt-2">
                <button onClick={() => { setShowForm(false); setEditing(null); }} className="btn-secondary">Cancelar</button>
                <button onClick={salvar} className="btn-primary">Salvar</button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default FornecedoresPage;
