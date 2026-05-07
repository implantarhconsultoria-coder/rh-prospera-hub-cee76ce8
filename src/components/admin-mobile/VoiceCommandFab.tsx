import React, { useEffect, useRef, useState } from 'react';
import { Mic, Loader2, X, CheckCircle2, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useApp } from '@/context/AppContext';
import { useNavigate } from 'react-router-dom';

// Web Speech API tipos mínimos
type SR = typeof window extends { SpeechRecognition: infer X } ? X : any;

interface VoiceAction {
  type:
    | 'navigate' | 'open_employee' | 'open_company'
    | 'print_epi' | 'print_uniforme'
    | 'print_recibo_vr' | 'print_recibo_vt'
    | 'print_relatorio_vr' | 'print_relatorio_vt'
    | 'print_protocolo_veiculo' | 'unknown';
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

const ROUTE_BY_PRINT: Record<string, string> = {
  print_epi: '/admin/epi',
  print_uniforme: '/admin/uniformes',
  print_recibo_vr: '/admin/relatorio-vr',
  print_recibo_vt: '/admin/relatorio-vt',
  print_relatorio_vr: '/admin/relatorio-vr',
  print_relatorio_vt: '/admin/relatorio-vt',
  print_protocolo_veiculo: '/admin/protocolo',
};

const norm = (s?: string) => (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

const VoiceCommandFab: React.FC = () => {
  const { employees, companies, session } = useApp();
  const nav = useNavigate();
  const { toast } = useToast();

  const [supported, setSupported] = useState(true);
  const [listening, setListening] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [action, setAction] = useState<VoiceAction | null>(null);
  const [historyId, setHistoryId] = useState<string | null>(null);
  const recRef = useRef<any>(null);

  useEffect(() => {
    const W: any = window;
    const SR = W.SpeechRecognition || W.webkitSpeechRecognition;
    if (!SR) { setSupported(false); return; }
    const rec = new SR();
    rec.lang = 'pt-BR';
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.continuous = false;
    rec.onresult = (e: any) => {
      const t = e.results?.[0]?.[0]?.transcript || '';
      setTranscript(t);
      setListening(false);
      void interpret(t);
    };
    rec.onerror = () => { setListening(false); toast({ title: 'Erro no microfone', description: 'Tente novamente.', variant: 'destructive' }); };
    rec.onend = () => setListening(false);
    recRef.current = rec;
  }, []);

  const start = () => {
    if (!recRef.current) return;
    setTranscript(''); setAction(null); setHistoryId(null);
    try { recRef.current.start(); setListening(true); } catch { /* já rodando */ }
  };

  const stop = () => { try { recRef.current?.stop(); } catch {} setListening(false); };

  const interpret = async (text: string) => {
    setProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke('voice-command', { body: { text } });
      if (error) throw error;
      const act: VoiceAction = data?.action || { type: 'unknown', label: 'Não entendi.' };
      setAction(act);
      // grava histórico (não confirmado ainda)
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
    } finally {
      setProcessing(false);
    }
  };

  const findEmployee = (q?: string, companyQ?: string) => {
    if (!q) return null;
    const nq = norm(q);
    let cands = employees.filter(e => norm(e.name).includes(nq) || nq.includes(norm(e.name).split(' ')[0]));
    if (companyQ) {
      const nc = norm(companyQ);
      const co = companies.filter(c => norm(c.name).includes(nc) || norm(c.codigo).includes(nc));
      const ids = new Set(co.map(c => c.id));
      const filtered = cands.filter(e => ids.has(e.companyId));
      if (filtered.length) cands = filtered;
    }
    return cands[0] || null;
  };

  const findCompany = (q?: string) => {
    if (!q) return null;
    const nq = norm(q);
    return companies.find(c => norm(c.name).includes(nq) || norm(c.codigo).includes(nq)) || null;
  };

  const finalize = async (confirmed: boolean, result: string) => {
    if (historyId) {
      await supabase.from('voice_command_history').update({
        confirmed, cancelled: !confirmed, result,
      }).eq('id', historyId);
    }
  };

  const execute = async () => {
    if (!action) return;
    let route: string | null = null;
    let result = '';

    switch (action.type) {
      case 'navigate':
        route = action.route || null;
        result = `Abrindo ${route}`;
        break;
      case 'open_employee': {
        const emp = findEmployee(action.query);
        if (!emp) { toast({ title: 'Funcionário não encontrado', description: action.query, variant: 'destructive' }); await finalize(false, 'employee_not_found'); return; }
        route = `/admin/funcionarios/${emp.id}`;
        result = `Funcionário: ${emp.name}`;
        break;
      }
      case 'open_company': {
        const co = findCompany(action.query);
        if (!co) { toast({ title: 'Empresa não encontrada', description: action.query, variant: 'destructive' }); await finalize(false, 'company_not_found'); return; }
        route = `/admin/empresas`;
        result = `Empresa: ${co.name}`;
        break;
      }
      case 'print_epi':
      case 'print_uniforme':
      case 'print_recibo_vr':
      case 'print_recibo_vt': {
        const emp = findEmployee(action.employee_query, action.company_query);
        if (!emp) { toast({ title: 'Funcionário não encontrado', variant: 'destructive' }); await finalize(false, 'employee_not_found'); return; }
        route = ROUTE_BY_PRINT[action.type];
        result = `${action.label} → ${emp.name}`;
        toast({ title: 'Tela aberta', description: `Selecione ${emp.name} e clique em imprimir.` });
        break;
      }
      case 'print_relatorio_vr':
      case 'print_relatorio_vt':
      case 'print_protocolo_veiculo':
        route = ROUTE_BY_PRINT[action.type];
        result = action.label;
        break;
      default:
        toast({ title: 'Não entendi o comando', description: action.reason || transcript, variant: 'destructive' });
        await finalize(false, 'unknown');
        return;
    }

    await finalize(true, result);
    setAction(null);
    setTranscript('');
    if (route) nav(route);
  };

  const cancel = async () => { await finalize(false, 'cancelled'); setAction(null); setTranscript(''); };

  if (!supported) return null;

  return (
    <>
      {/* FAB */}
      <button
        onClick={listening ? stop : start}
        aria-label="Comando de voz"
        className="fixed bottom-5 right-5 z-40 w-14 h-14 rounded-full bg-gradient-to-br from-primary to-accent text-primary-foreground shadow-xl flex items-center justify-center active:scale-95 transition"
      >
        {listening ? <Loader2 className="w-6 h-6 animate-spin" /> : <Mic className="w-6 h-6" />}
      </button>

      {/* Listening overlay */}
      <AnimatePresence>
        {listening && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/70 flex flex-col items-center justify-center p-6"
            onClick={stop}
          >
            <div className="w-24 h-24 rounded-full bg-primary/20 flex items-center justify-center mb-4 animate-pulse">
              <Mic className="w-12 h-12 text-primary-foreground" />
            </div>
            <p className="text-primary-foreground text-lg font-medium">Estou ouvindo...</p>
            <p className="text-primary-foreground/60 text-xs mt-1">Toque para cancelar</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Confirmation */}
      <AnimatePresence>
        {(action || processing) && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-4"
            onClick={() => !processing && cancel()}
          >
            <motion.div
              initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="bg-card border border-border rounded-2xl w-full max-w-sm p-5 shadow-2xl"
              onClick={e => e.stopPropagation()}
            >
              {processing ? (
                <div className="flex flex-col items-center py-4">
                  <Loader2 className="w-10 h-10 animate-spin text-primary mb-3" />
                  <p className="text-sm text-muted-foreground">Interpretando comando...</p>
                  {transcript && <p className="text-xs italic mt-2 text-center">"{transcript}"</p>}
                </div>
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
                      <Button className="flex-1" onClick={execute}>
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
