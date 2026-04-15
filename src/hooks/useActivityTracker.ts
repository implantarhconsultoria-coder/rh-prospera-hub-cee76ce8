import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import type { Session } from '@supabase/supabase-js';

export function useActivityTracker(session: Session | null) {
  const location = useLocation();
  const logIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!session?.user) return;

    const insertLog = async () => {
      const { data } = await supabase.from('activity_log').insert({
        user_id: session.user.id,
        email: session.user.email || '',
        nome: session.user.user_metadata?.nome_completo || session.user.email || '',
        module: getModule(location.pathname),
        route: location.pathname,
        filial: 'Central',
        action: 'login',
        status: 'online',
      } as any).select('id').single();
      if (data) logIdRef.current = data.id;
    };

    insertLog();

    return () => {
      if (logIdRef.current) {
        supabase.from('activity_log').update({ status: 'desconectado', last_activity_at: new Date().toISOString() } as any)
          .eq('id', logIdRef.current).then(() => {});
      }
    };
  }, [session?.user?.id]);

  // Update route on navigation
  useEffect(() => {
    if (!logIdRef.current) return;
    supabase.from('activity_log').update({
      route: location.pathname,
      module: getModule(location.pathname),
      last_activity_at: new Date().toISOString(),
      status: 'online',
    } as any).eq('id', logIdRef.current).then(() => {});
  }, [location.pathname]);
}

function getModule(path: string): string {
  const map: Record<string, string> = {
    '/': 'Dashboard', '/empresas': 'Empresas', '/base-mestra': 'Base Mestra',
    '/funcionarios': 'Funcionários', '/lancamentos': 'Lançamentos', '/fechamento': 'Fechamento',
    '/relatorio': 'Relatório', '/epi': 'EPI', '/uniformes': 'Uniformes',
    '/relatorio-vr': 'VR', '/relatorio-vt': 'VT', '/combustivel': 'Combustível',
    '/protocolo': 'Protocolo', '/documentos-ativos': 'Doc. Veículos',
    '/aviso-ferias': 'Férias', '/aso': 'ASO', '/prestadores': 'Prestadores',
    '/historico': 'Histórico', '/almoxarifado': 'Almoxarifado',
    '/monitoramento': 'Monitoramento', '/configuracoes': 'Configurações',
  };
  return map[path] || path;
}
