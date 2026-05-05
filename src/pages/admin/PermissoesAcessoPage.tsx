import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Search, ShieldCheck, Building2, Copy, Check } from 'lucide-react';
import { toast } from 'sonner';

type Func = { id: string; nome: string; cpf: string | null; cargo: string | null; status: string | null; company_id: string | null; empresa_nome?: string };
type Perm = { funcionario_id: string; modulo: string; ativo: boolean };

const MODULOS = [
  { key: 'rh_filial',   label: 'RH da Filial' },
  { key: 'financeiro',  label: 'Financeiro' },
  { key: 'faturamento', label: 'Faturamento' },
  { key: 'mecanicos',   label: 'App Mecânicos' },
] as const;

const UNIDADE_OPCOES = [
  { slug: 'sp', label: 'São Paulo (ALQUI / TOPAC MATRIZ / LMT)' },
  { slug: 'pg', label: 'Praia Grande (TOPAC PRAIA GRANDE)' },
  { slug: 'go', label: 'Goiânia (TOPAC GOIÂNIA)' },
];

const PermissoesAcessoPage: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [funcs, setFuncs] = useState<Func[]>([]);
  const [perms, setPerms] = useState<Record<string, Record<string, boolean>>>({});
  const [busca, setBusca] = useState('');
  const [filtroEmpresa, setFiltroEmpresa] = useState<string>('todas');
  const [copiado, setCopiado] = useState<string | null>(null);

  const carregar = async () => {
    setLoading(true);
    const [{ data: f }, { data: p }] = await Promise.all([
      supabase.from('funcionarios').select('id, nome, cpf, cargo, status, company_id, empresas:company_id(nome)').order('nome'),
      supabase.from('permissoes_acesso').select('funcionario_id, modulo, ativo'),
    ]);
    const lista: Func[] = (f || []).map((x: any) => ({
      id: x.id, nome: x.nome, cpf: x.cpf, cargo: x.cargo, status: x.status, company_id: x.company_id,
      empresa_nome: x.empresas?.nome || '',
    }));
    const map: Record<string, Record<string, boolean>> = {};
    (p as Perm[] | null || []).forEach(pp => {
      map[pp.funcionario_id] = map[pp.funcionario_id] || {};
      map[pp.funcionario_id][pp.modulo] = pp.ativo;
    });
    setFuncs(lista);
    setPerms(map);
    setLoading(false);
  };

  useEffect(() => { carregar(); }, []);

  const empresas = useMemo(() => Array.from(new Set(funcs.map(f => f.empresa_nome).filter(Boolean))).sort(), [funcs]);

  const filtrados = useMemo(() => {
    const t = busca.trim().toLowerCase();
    return funcs.filter(f => {
      if (filtroEmpresa !== 'todas' && f.empresa_nome !== filtroEmpresa) return false;
      if (!t) return true;
      return f.nome.toLowerCase().includes(t) || (f.cpf || '').includes(t) || (f.cargo || '').toLowerCase().includes(t);
    });
  }, [funcs, busca, filtroEmpresa]);

  const togglePerm = async (funcionario_id: string, modulo: string) => {
    const atual = perms[funcionario_id]?.[modulo] || false;
    const novo = !atual;
    setPerms(prev => ({ ...prev, [funcionario_id]: { ...(prev[funcionario_id] || {}), [modulo]: novo } }));
    const { error } = await supabase.from('permissoes_acesso')
      .upsert({ funcionario_id, modulo, ativo: novo }, { onConflict: 'funcionario_id,modulo' });
    if (error) {
      toast.error('Falha ao salvar permissão');
      setPerms(prev => ({ ...prev, [funcionario_id]: { ...(prev[funcionario_id] || {}), [modulo]: atual } }));
    } else {
      toast.success(novo ? 'Módulo liberado' : 'Módulo bloqueado');
    }
  };

  const copiar = async (slug: string) => {
    const url = `${window.location.origin}/${slug}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiado(slug);
      toast.success('Link copiado');
      setTimeout(() => setCopiado(null), 1500);
    } catch {
      toast.error('Não foi possível copiar');
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center min-h-[60vh]"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <ShieldCheck className="w-7 h-7 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Permissões de Acesso por CPF</h1>
          <p className="text-sm text-muted-foreground">Habilite os módulos liberados para cada funcionário acessar pelos links /sp, /pg e /go.</p>
        </div>
      </div>

      {/* Links fixos */}
      <div className="grid md:grid-cols-3 gap-3">
        {UNIDADE_OPCOES.map(u => {
          const url = `${window.location.origin}/${u.slug}`;
          return (
            <div key={u.slug} className="border rounded-xl p-4 bg-card">
              <div className="flex items-center gap-2 mb-2">
                <Building2 className="w-4 h-4 text-primary" />
                <span className="font-semibold text-sm">/{u.slug}</span>
              </div>
              <p className="text-xs text-muted-foreground mb-2">{u.label}</p>
              <div className="flex gap-2 items-center">
                <input readOnly value={url} className="flex-1 text-xs bg-muted px-2 py-1.5 rounded border" />
                <button onClick={() => copiar(u.slug)} className="p-2 rounded border hover:bg-muted">
                  {copiado === u.slug ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[260px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={busca}
            onChange={e => setBusca(e.target.value)}
            placeholder="Buscar por nome, CPF ou cargo..."
            className="w-full pl-10 pr-3 py-2 border rounded-lg bg-background"
          />
        </div>
        <select value={filtroEmpresa} onChange={e => setFiltroEmpresa(e.target.value)} className="px-3 py-2 border rounded-lg bg-background">
          <option value="todas">Todas as empresas</option>
          {empresas.map(e => <option key={e} value={e}>{e}</option>)}
        </select>
        <span className="text-xs text-muted-foreground">{filtrados.length} funcionário(s)</span>
      </div>

      {/* Tabela */}
      <div className="border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted">
            <tr>
              <th className="text-left px-3 py-2">Funcionário</th>
              <th className="text-left px-3 py-2">CPF</th>
              <th className="text-left px-3 py-2">Empresa</th>
              <th className="text-left px-3 py-2">Status</th>
              {MODULOS.map(m => <th key={m.key} className="text-center px-3 py-2">{m.label}</th>)}
            </tr>
          </thead>
          <tbody>
            {filtrados.map(f => (
              <tr key={f.id} className="border-t hover:bg-muted/50">
                <td className="px-3 py-2">
                  <div className="font-medium">{f.nome}</div>
                  <div className="text-xs text-muted-foreground">{f.cargo}</div>
                </td>
                <td className="px-3 py-2 text-xs">{f.cpf || '—'}</td>
                <td className="px-3 py-2 text-xs">{f.empresa_nome || '—'}</td>
                <td className="px-3 py-2">
                  <span className={`text-[10px] px-2 py-0.5 rounded ${(f.status || '').toLowerCase() === 'ativo' ? 'bg-emerald-500/15 text-emerald-700' : 'bg-amber-500/15 text-amber-700'}`}>
                    {f.status || '—'}
                  </span>
                </td>
                {MODULOS.map(m => {
                  const ativo = perms[f.id]?.[m.key] || false;
                  return (
                    <td key={m.key} className="px-3 py-2 text-center">
                      <button
                        onClick={() => togglePerm(f.id, m.key)}
                        className={`w-11 h-6 rounded-full transition-colors relative ${ativo ? 'bg-primary' : 'bg-muted-foreground/30'}`}
                        title={ativo ? 'Liberado' : 'Bloqueado'}
                      >
                        <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${ativo ? 'translate-x-5' : 'translate-x-0.5'}`} />
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
            {filtrados.length === 0 && (
              <tr><td colSpan={4 + MODULOS.length} className="px-3 py-8 text-center text-sm text-muted-foreground">Nenhum funcionário encontrado.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default PermissoesAcessoPage;
