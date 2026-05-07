import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import AssistenteChat from '@/components/assistente/AssistenteChat';
import { Button } from '@/components/ui/button';
import { Plus, MessageSquare, Sparkles } from 'lucide-react';

interface Conv { id: string; titulo: string; updated_at: string; }

const AssistentePage: React.FC = () => {
  const [convs, setConvs] = useState<Conv[]>([]);
  const [active, setActive] = useState<string | null>(null);

  const load = async () => {
    const { data } = await supabase
      .from('assistente_conversas')
      .select('id, titulo, updated_at')
      .order('updated_at', { ascending: false })
      .limit(50);
    setConvs(data || []);
  };

  useEffect(() => { load(); }, []);

  return (
    <div className="h-[calc(100vh-64px)] flex bg-background">
      <aside className="hidden md:flex flex-col w-72 border-r">
        <div className="p-3 border-b">
          <Button onClick={() => setActive(null)} className="w-full" variant="outline">
            <Plus className="h-4 w-4 mr-2" /> Nova conversa
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {convs.length === 0 && (
            <div className="text-xs text-muted-foreground p-4 flex items-center gap-2">
              <Sparkles className="h-4 w-4" /> Sem conversas ainda
            </div>
          )}
          {convs.map(c => (
            <button
              key={c.id}
              onClick={() => setActive(c.id)}
              className={`w-full text-left px-3 py-2 text-sm hover:bg-muted flex items-start gap-2 ${active === c.id ? 'bg-muted' : ''}`}
            >
              <MessageSquare className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
              <span className="truncate">{c.titulo}</span>
            </button>
          ))}
        </div>
      </aside>

      <main className="flex-1 min-w-0">
        <AssistenteChat
          className="h-full"
          conversaId={active}
          onConversaCreated={(id) => { setActive(id); load(); }}
        />
      </main>
    </div>
  );
};

export default AssistentePage;
