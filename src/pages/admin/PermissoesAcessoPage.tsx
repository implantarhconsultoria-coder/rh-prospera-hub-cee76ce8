import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Loader2, Plus, Trash2, KeyRound, Save, ShieldCheck, X } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';

type AppRole = 'admin' | 'filial_praia' | 'filial_goiania' | 'financeiro' | 'faturamento';

const ROLE_LABELS: Record<AppRole, { label: string; desc: string; cor: string }> = {
  admin:          { label: 'ADMIN',        desc: 'Acesso total à plataforma',                 cor: 'bg-red-100 text-red-700 border-red-300' },
  filial_praia:   { label: 'RH PRAIA',     desc: 'RH da TOPAC PRAIA GRANDE',                  cor: 'bg-blue-100 text-blue-700 border-blue-300' },
  filial_goiania: { label: 'RH GOIÂNIA',   desc: 'RH da TOPAC GOIÂNIA',                       cor: 'bg-emerald-100 text-emerald-700 border-emerald-300' },
  financeiro:     { label: 'FINANCEIRO',   desc: 'Módulo financeiro (todas as empresas)',     cor: 'bg-cyan-100 text-cyan-700 border-cyan-300' },
  faturamento:    { label: 'FATURAMENTO',  desc: 'Módulo faturamento (todas as empresas)',    cor: 'bg-indigo-100 text-indigo-700 border-indigo-300' },
};
const ALL_ROLES: AppRole[] = ['admin','filial_praia','filial_goiania','financeiro','faturamento'];

interface UsuarioRow {
  user_id: string;
  email: string;
  nome: string | null;
  roles: AppRole[];
}

const PermissoesAcessoPage: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [usuarios, setUsuarios] = useState<UsuarioRow[]>([]);

  // Dialog criar
  const [openNovo, setOpenNovo] = useState(false);
  const [novoEmail, setNovoEmail] = useState('');
  const [novoNome, setNovoNome] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [novosRoles, setNovosRoles] = useState<AppRole[]>([]);

  // Dialog senha
  const [openSenha, setOpenSenha] = useState<UsuarioRow | null>(null);
  const [senhaNova, setSenhaNova] = useState('');

  const carregar = async () => {
    setLoading(true);
    try {
      // Lista todos os usuários a partir de profiles + user_roles
      const { data: profs } = await supabase
        .from('profiles')
        .select('user_id, email, nome_completo')
        .order('nome_completo');
      const { data: roles } = await supabase
        .from('user_roles')
        .select('user_id, role');
      const map = new Map<string, UsuarioRow>();
      (profs || []).forEach((p) => {
        map.set(p.user_id, {
          user_id: p.user_id,
          email: p.email || '',
          nome: p.nome_completo,
          roles: [],
        });
      });
      (roles || []).forEach((r) => {
        const u = map.get(r.user_id);
        if (u) u.roles.push(r.role as AppRole);
        else map.set(r.user_id, { user_id: r.user_id, email: '', nome: null, roles: [r.role as AppRole] });
      });
      setUsuarios(Array.from(map.values()).sort((a,b) => (a.nome || a.email).localeCompare(b.nome || b.email)));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { carregar(); }, []);

  const callFn = async (body: Record<string, unknown>) => {
    const { data, error } = await supabase.functions.invoke('admin-criar-usuario', { body });
    if (error) throw new Error(error.message);
    if (data?.error) throw new Error(data.error);
    return data;
  };

  const criarUsuario = async () => {
    if (!novoEmail.trim() || novaSenha.length < 6 || novosRoles.length === 0) {
      toast.error('Preencha email, senha (mínimo 6) e ao menos 1 módulo'); return;
    }
    setBusy(true);
    try {
      await callFn({
        action: 'create',
        email: novoEmail.trim().toLowerCase(),
        password: novaSenha,
        nome: novoNome,
        roles: novosRoles,
      });
      toast.success('Usuário criado');
      setOpenNovo(false);
      setNovoEmail(''); setNovoNome(''); setNovaSenha(''); setNovosRoles([]);
      carregar();
    } catch (e) {
      toast.error('Erro: ' + (e as Error).message);
    } finally { setBusy(false); }
  };

  const toggleRole = async (u: UsuarioRow, role: AppRole) => {
    const novos = u.roles.includes(role)
      ? u.roles.filter(r => r !== role)
      : [...u.roles, role];
    if (novos.length === 0) { toast.error('Usuário precisa ter ao menos 1 módulo'); return; }
    setBusy(true);
    try {
      await callFn({ action: 'update_roles', user_id: u.user_id, roles: novos });
      toast.success('Permissões atualizadas');
      carregar();
    } catch (e) {
      toast.error('Erro: ' + (e as Error).message);
    } finally { setBusy(false); }
  };

  const resetSenha = async () => {
    if (!openSenha || senhaNova.length < 6) { toast.error('Senha mínima de 6 caracteres'); return; }
    setBusy(true);
    try {
      await callFn({ action: 'reset_password', user_id: openSenha.user_id, password: senhaNova });
      toast.success('Senha redefinida');
      setOpenSenha(null); setSenhaNova('');
    } catch (e) {
      toast.error('Erro: ' + (e as Error).message);
    } finally { setBusy(false); }
  };

  const apagar = async (u: UsuarioRow) => {
    if (!confirm(`Apagar o usuário ${u.email}?`)) return;
    setBusy(true);
    try {
      await callFn({ action: 'delete', user_id: u.user_id });
      toast.success('Usuário apagado');
      carregar();
    } catch (e) {
      toast.error('Erro: ' + (e as Error).message);
    } finally { setBusy(false); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-primary" /> Usuários e Permissões
          </h1>
          <p className="text-sm text-muted-foreground">Login por email e senha. Cada usuário pode ter múltiplos módulos.</p>
        </div>
        <Button onClick={() => setOpenNovo(true)}><Plus className="w-4 h-4 mr-1" /> Novo usuário</Button>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Módulos disponíveis</CardTitle></CardHeader>
        <CardContent>
          <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {ALL_ROLES.map(r => (
              <div key={r} className={`border rounded-lg p-3 ${ROLE_LABELS[r].cor}`}>
                <div className="font-bold text-xs">{ROLE_LABELS[r].label}</div>
                <div className="text-[11px] mt-1">{ROLE_LABELS[r].desc}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Usuários cadastrados ({usuarios.length})</CardTitle></CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
          ) : usuarios.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Nenhum usuário cadastrado ainda.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="py-2">Nome / Email</th>
                    <th className="py-2">Módulos liberados</th>
                    <th className="py-2 w-32 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {usuarios.map(u => (
                    <tr key={u.user_id} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="py-3">
                        <div className="font-medium">{u.nome || '—'}</div>
                        <div className="text-xs text-muted-foreground">{u.email}</div>
                      </td>
                      <td className="py-3">
                        <div className="flex flex-wrap gap-1.5">
                          {ALL_ROLES.map(r => {
                            const ativo = u.roles.includes(r);
                            return (
                              <button
                                key={r}
                                disabled={busy}
                                onClick={() => toggleRole(u, r)}
                                className={`px-2 py-1 rounded-md text-[10px] font-bold border transition ${
                                  ativo ? ROLE_LABELS[r].cor : 'bg-muted text-muted-foreground border-transparent opacity-60 hover:opacity-100'
                                }`}
                                title={ROLE_LABELS[r].desc}
                              >
                                {ROLE_LABELS[r].label}
                              </button>
                            );
                          })}
                        </div>
                      </td>
                      <td className="py-3 text-right">
                        <Button size="sm" variant="outline" onClick={() => setOpenSenha(u)} className="mr-1">
                          <KeyRound className="w-3 h-3" />
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => apagar(u)} className="text-destructive hover:bg-destructive/10">
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog criar */}
      <Dialog open={openNovo} onOpenChange={setOpenNovo}>
        <DialogContent>
          <DialogHeader><DialogTitle>Novo usuário</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nome completo</Label>
              <Input value={novoNome} onChange={e => setNovoNome(e.target.value)} />
            </div>
            <div>
              <Label>Email</Label>
              <Input type="email" value={novoEmail} onChange={e => setNovoEmail(e.target.value)} />
            </div>
            <div>
              <Label>Senha inicial</Label>
              <Input type="text" value={novaSenha} onChange={e => setNovaSenha(e.target.value)} placeholder="mínimo 6 caracteres" />
            </div>
            <div>
              <Label>Módulos liberados</Label>
              <div className="grid grid-cols-1 gap-2 mt-2">
                {ALL_ROLES.map(r => (
                  <label key={r} className="flex items-start gap-2 p-2 border rounded-md cursor-pointer hover:bg-muted/30">
                    <Checkbox
                      checked={novosRoles.includes(r)}
                      onCheckedChange={(c) => setNovosRoles(prev => c ? [...prev, r] : prev.filter(x => x !== r))}
                    />
                    <div>
                      <div className="text-sm font-medium">{ROLE_LABELS[r].label}</div>
                      <div className="text-[11px] text-muted-foreground">{ROLE_LABELS[r].desc}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenNovo(false)}>Cancelar</Button>
            <Button onClick={criarUsuario} disabled={busy}>
              {busy ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Save className="w-4 h-4 mr-1" />} Criar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog senha */}
      <Dialog open={!!openSenha} onOpenChange={(o) => !o && setOpenSenha(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Redefinir senha</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">{openSenha?.email}</p>
          <Input type="text" value={senhaNova} onChange={e => setSenhaNova(e.target.value)} placeholder="Nova senha (mínimo 6)" />
          <DialogFooter>
            <Button variant="outline" onClick={() => { setOpenSenha(null); setSenhaNova(''); }}>Cancelar</Button>
            <Button onClick={resetSenha} disabled={busy}>
              {busy ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <KeyRound className="w-4 h-4 mr-1" />} Redefinir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PermissoesAcessoPage;
