import React, { useEffect, useRef, useState } from 'react';
import { Mic, Loader2, X, CheckCircle2, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useApp } from '@/context/AppContext';
import { useNavigate } from 'react-router-dom';
import { openDocumentInNewTab } from '@/lib/documentUrl';

interface VoiceAction {
  type:
    | 'navigate' | 'open_employee' | 'open_company'
    | 'print_epi' | 'print_uniforme'
    | 'print_recibo_vr' | 'print_recibo_vt' | 'print_recibo_vrvt'
    | 'print_relatorio_vr' | 'print_relatorio_vt'
    | 'print_protocolo_veiculo' | 'print_documento_veiculo'
    | 'unknown';
  label: string;
  route?: string;
  query?: string;
  employee_query?: string;
  company_query?: string;
  mes?: number;
  ano?: number;
  placa?: string;
  reason?: string;
}

const norm = (s?: string) => (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

const buildCompetencia = (mes?: number, ano?: number) => {
  const now = new Date();
  const m = mes && mes >= 1 && mes <= 12 ? mes : now.getMonth() + 1;
  const y = ano && ano >= 2000 ? ano : now.getFullYear();
  return `${y}-${String(m).padStart(2, '0')}`;
};

const VoiceCommandFab: React.FC = () => {
  const { employees, companies, session } = useApp();
  const nav = useNavigate();
  const { toast } = useToast();

  const [supported, setSupported] = useState(true);
  const [listening, setListening] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [action, setAction] = useState<VoiceAction | null>(null);
  const [empChoices, setEmpChoices] = useState<any[] | null>(null);
  const [vehicleChoices, setVehicleChoices] = useState<any[] | null>(null);
  const [historyId, setHistoryId] = useState<string | null>(null);
  const recRef = useRef<any>(null);

  useEffect(() => {
    const W: any = window;
    const SR = W.SpeechRecognition || W.webkitSpeechRecognition;
    if (!SR) { setSupported(false); return; }
    const rec = new SR();
    rec.lang = 'pt-BR'; rec.interimResults = false; rec.maxAlternatives = 1; rec.continuous = false;
    rec.onresult = (e: any) => { const t = e.results?.[0]?.[0]?.transcript || ''; setTranscript(t); setListening(false); void interpret(t); };
    rec.onerror = () => { setListening(false); toast({ title: 'Erro no microfone', variant: 'destructive' }); };
    rec.onend = () => setListening(false);
    recRef.current = rec;
  }, []);

  const reset = () => { setAction(null); setEmpChoices(null); setVehicleChoices(null); setTranscript(''); };

  const start = () => {
    if (!recRef.current) return;
    reset(); setHistoryId(null);
    try { recRef.current.start(); setListening(true); } catch { /* */ }
  };
  const stop = () => { try { recRef.current?.stop(); } catch {} setListening(false); };

  const interpret = async (text: string) => {
    setProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke('voice-command', { body: { text } });
      if (error) throw error;
      const act: VoiceAction = data?.action || { type: 'unknown', label: 'Não entendi.' };
      setAction(act);
      if (session?.user?.id) {
        const { data: ins } = await supabase
          .from('voice_command_history')
          .insert({ user_id: session.user.id, spoken_text: text, interpreted_action: act as any })
          .select('id').single();
        if (ins?.id) setHistoryId(ins.id);
      }
    } catch (e: any) {
      toast({ title: 'Falha ao interpretar', description: e?.message || 'Erro', variant: 'destructive' });
      setAction({ type: 'unknown', label: 'Não foi possível interpretar.' });
    } finally { setProcessing(false); }
  };

  const findEmployees = (q?: string, companyQ?: string): any[] => {
    if (!q) return [];
    const nq = norm(q);
    const tokens = nq.split(/\s+/).filter(Boolean);
    let cands = employees.filter(e => {
      const en = norm(e.name);
      return tokens.every(t => en.includes(t)) || en.includes(nq);
    });
    if (cands.length === 0) {
      cands = employees.filter(e => tokens.some(t => norm(e.name).split(/\s+/).includes(t)));
    }
    if (companyQ) {
      const nc = norm(companyQ);
      const co = companies.filter(c => norm(c.name).includes(nc) || norm((c as any).codigo || '').includes(nc));
      const ids = new Set(co.map(c => c.id));
      const filtered = cands.filter(e => ids.has(e.companyId));
      if (filtered.length) cands = filtered;
    }
    return cands;
  };

  const findCompany = (q?: string) => {
    if (!q) return null;
    const nq = norm(q);
    return companies.find(c => norm(c.name).includes(nq) || norm((c as any).codigo || '').includes(nq)) || null;
  };

  const findVehicles = async (placa?: string): Promise<any[]> => {
    if (!placa) return [];
    const np = norm(placa).replace(/[^a-z0-9]/g, '');
    const { data } = await supabase.from('ativos').select('*').ilike('tipo', '%veicul%').limit(200);
    const list = (data || []).filter((a: any) => norm(a.placa || '').replace(/[^a-z0-9]/g, '').includes(np));
    return list;
  };

  const finalize = async (confirmed: boolean, result: string) => {
    if (historyId) {
      await supabase.from('voice_command_history').update({
        confirmed, cancelled: !confirmed, result,
      }).eq('id', historyId);
    }
  };

  const openReciboIndividual = (tipo: 'vr' | 'vt' | 'ambos', emp: any, mes?: number, ano?: number) => {
    const competencia = buildCompetencia(mes, ano);
    const formato = tipo === 'ambos' ? 'ambos' : tipo;
    const url = `/recibos-beneficio?formato=${formato}&competencia=${competencia}&empresas=${emp.companyId}&funcionarios=${emp.id}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const openRelatorioConsolidado = (tipo: 'vr' | 'vt', companyId: string, mes?: number, ano?: number) => {
    const competencia = buildCompetencia(mes, ano);
    const route = tipo === 'vr' ? '/relatorio-vr-impressao' : '/relatorio-vt-impressao';
    window.open(`${route}?competencia=${competencia}&empresas=${companyId}`, '_blank', 'noopener,noreferrer');
  };

  const executeWith = async (act: VoiceAction, chosenEmp?: any, chosenVehicle?: any) => {
    let result = '';
    switch (act.type) {
      case 'navigate':
        if (act.route) nav(act.route);
        result = `Abrindo ${act.route}`;
        break;
      case 'open_employee': {
        const emp = chosenEmp || findEmployees(act.query)[0];
        if (!emp) { toast({ title: 'Funcionário não encontrado', variant: 'destructive' }); await finalize(false, 'employee_not_found'); return; }
        nav(`/admin/funcionarios/${emp.id}`);
        result = `Funcionário: ${emp.name}`;
        break;
      }
      case 'open_company': {
        const co = findCompany(act.query);
        if (!co) { toast({ title: 'Empresa não encontrada', variant: 'destructive' }); await finalize(false, 'company_not_found'); return; }
        nav('/admin/empresas');
        result = `Empresa: ${co.name}`;
        break;
      }
      case 'print_recibo_vr':
      case 'print_recibo_vt':
      case 'print_recibo_vrvt': {
        const cands = chosenEmp ? [chosenEmp] : findEmployees(act.employee_query, act.company_query);
        if (cands.length === 0) { toast({ title: 'Funcionário não encontrado', description: act.employee_query, variant: 'destructive' }); await finalize(false, 'employee_not_found'); return; }
        if (cands.length > 1 && !chosenEmp) { setEmpChoices(cands.slice(0, 8)); return; }
        const emp = cands[0];
        const tipo = act.type === 'print_recibo_vr' ? 'vr' : act.type === 'print_recibo_vt' ? 'vt' : 'ambos';
        openReciboIndividual(tipo as any, emp, act.mes, act.ano);
        result = `Recibo ${tipo.toUpperCase()} → ${emp.name}`;
        toast({ title: 'PDF aberto', description: `${emp.name} — ${buildCompetencia(act.mes, act.ano)}` });
        break;
      }
      case 'print_relatorio_vr':
      case 'print_relatorio_vt': {
        const co = findCompany(act.company_query);
        if (!co) {
          // Sem empresa → abrir tela do relatório p/ escolher
          const route = act.type === 'print_relatorio_vr' ? '/admin/relatorio-vr' : '/admin/relatorio-vt';
          nav(route);
          result = act.label;
          break;
        }
        const tipo = act.type === 'print_relatorio_vr' ? 'vr' : 'vt';
        openRelatorioConsolidado(tipo, co.id, act.mes, act.ano);
        result = `Relatório ${tipo.toUpperCase()} → ${co.name}`;
        break;
      }
      case 'print_epi':
      case 'print_uniforme': {
        const cands = chosenEmp ? [chosenEmp] : findEmployees(act.employee_query, act.company_query);
        if (cands.length === 0) { toast({ title: 'Funcionário não encontrado', variant: 'destructive' }); await finalize(false, 'employee_not_found'); return; }
        if (cands.length > 1 && !chosenEmp) { setEmpChoices(cands.slice(0, 8)); return; }
        const emp = cands[0];
        const route = act.type === 'print_epi' ? '/admin/epi' : '/admin/uniformes';
        nav(`${route}?funcionario=${emp.id}`);
        toast({ title: 'Tela aberta', description: `${emp.name} — clique em imprimir.` });
        result = `${act.label} → ${emp.name}`;
        break;
      }
      case 'print_documento_veiculo': {
        let veh = chosenVehicle;
        if (!veh) {
          const list = await findVehicles(act.placa);
          if (list.length === 0) { toast({ title: 'Veículo não encontrado', description: act.placa, variant: 'destructive' }); await finalize(false, 'vehicle_not_found'); return; }
          if (list.length > 1) { setVehicleChoices(list.slice(0, 8)); return; }
          veh = list[0];
        }
        if (!veh.arquivo_url) {
          toast({ title: 'Sem documento anexado', description: `Veículo ${veh.placa} encontrado, mas sem PDF.`, variant: 'destructive' });
          await finalize(false, 'no_document');
          return;
        }
        const ok = await openDocumentInNewTab({ url: veh.arquivo_url, tipo: 'veiculo' });
        if (!ok) { toast({ title: 'Não foi possível abrir o documento', variant: 'destructive' }); await finalize(false, 'open_failed'); return; }
        result = `Documento veículo ${veh.placa}`;
        break;
      }
      case 'print_protocolo_veiculo':
        nav(act.placa ? `/admin/protocolo?placa=${encodeURIComponent(act.placa)}` : '/admin/protocolo');
        result = act.label;
        break;
      default:
        toast({ title: 'Não entendi', description: act.reason || transcript, variant: 'destructive' });
        await finalize(false, 'unknown');
        return;
    }
    await finalize(true, result);
    reset();
  };

  const cancel = async () => { await finalize(false, 'cancelled'); reset(); };

  if (!supported) return null;

  return (
    <>
      <button
        onClick={listening ? stop : start}
        aria-label="Comando de voz"
        className="fixed bottom-5 right-5 z-40 w-14 h-14 rounded-full bg-gradient-to-br from-primary to-accent text-primary-foreground shadow-xl flex items-center justify-center active:scale-95 transition"
      >
        {listening ? <Loader2 className="w-6 h-6 animate-spin" /> : <Mic className="w-6 h-6" />}
      </button>

      <AnimatePresence>
        {listening && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/70 flex flex-col items-center justify-center p-6" onClick={stop}>
            <div className="w-24 h-24 rounded-full bg-primary/20 flex items-center justify-center mb-4 animate-pulse">
              <Mic className="w-12 h-12 text-primary-foreground" />
            </div>
            <p className="text-primary-foreground text-lg font-medium">Estou ouvindo...</p>
            <p className="text-primary-foreground/60 text-xs mt-1">Toque para cancelar</p>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {(action || processing) && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-4"
            onClick={() => !processing && cancel()}>
            <motion.div initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="bg-card border border-border rounded-2xl w-full max-w-sm p-5 shadow-2xl"
              onClick={e => e.stopPropagation()}>
              {processing ? (
                <div className="flex flex-col items-center py-4">
                  <Loader2 className="w-10 h-10 animate-spin text-primary mb-3" />
                  <p className="text-sm text-muted-foreground">Interpretando comando...</p>
                  {transcript && <p className="text-xs italic mt-2 text-center">"{transcript}"</p>}
                </div>
              ) : empChoices ? (
                <>
                  <h3 className="font-semibold mb-3">Encontrei mais de um funcionário. Qual?</h3>
                  <div className="space-y-2 max-h-72 overflow-y-auto">
                    {empChoices.map(e => {
                      const co = companies.find(c => c.id === e.companyId);
                      return (
                        <button key={e.id} onClick={() => action && executeWith(action, e)}
                          className="w-full text-left p-3 rounded-lg border border-border hover:bg-muted text-sm">
                          <div className="font-medium">{e.name}</div>
                          <div className="text-xs text-muted-foreground">{co?.name || '—'}</div>
                        </button>
                      );
                    })}
                  </div>
                  <Button variant="outline" className="w-full mt-3" onClick={cancel}>Cancelar</Button>
                </>
              ) : vehicleChoices ? (
                <>
                  <h3 className="font-semibold mb-3">Encontrei mais de um veículo. Qual?</h3>
                  <div className="space-y-2 max-h-72 overflow-y-auto">
                    {vehicleChoices.map(v => (
                      <button key={v.id} onClick={() => action && executeWith(action, undefined, v)}
                        className="w-full text-left p-3 rounded-lg border border-border hover:bg-muted text-sm">
                        <div className="font-medium">{v.placa} {v.marca ? `· ${v.marca}` : ''} {v.descricao ? `· ${v.descricao}` : ''}</div>
                        <div className="text-xs text-muted-foreground">{v.empresa || '—'}</div>
                      </button>
                    ))}
                  </div>
                  <Button variant="outline" className="w-full mt-3" onClick={cancel}>Cancelar</Button>
                </>
              ) : action && (
                <>
                  <div className="flex items-start gap-3 mb-4">
                    {action.type === 'unknown'
                      ? <AlertCircle className="w-7 h-7 text-destructive shrink-0 mt-0.5" />
                      : <CheckCircle2 className="w-7 h-7 text-green-500 shrink-0 mt-0.5" />}
                    <div className="flex-1">
                      <h3 className="font-semibold text-foreground">{action.label}</h3>
                      {transcript && <p className="text-xs text-muted-foreground italic mt-1">"{transcript}"</p>}
                      {action.reason && <p className="text-xs text-destructive mt-1">{action.reason}</p>}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" className="flex-1" onClick={cancel}>
                      <X className="w-4 h-4 mr-1" /> Cancelar
                    </Button>
                    {action.type !== 'unknown' && (
                      <Button className="flex-1" onClick={() => executeWith(action)}>
                        <CheckCircle2 className="w-4 h-4 mr-1" /> Confirmar
                      </Button>
                    )}
                  </div>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default VoiceCommandFab;
