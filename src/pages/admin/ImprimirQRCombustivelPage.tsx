/**
 * Página de impressão dos QR Codes TOPAC-ABAST.
 * Layout segue o modelo: borda arredondada, título TOPAC, QR grande, código abaixo.
 * Acessível em /admin/combustivel/imprimir
 */
import React, { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import QRCodeLib from 'qrcode';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Printer, ArrowLeft, Loader2 } from 'lucide-react';

interface Vale {
  id: string;
  codigo: string;
  posto_nome: string;
  posto_cnpj: string;
  posto_endereco: string;
  status: string;
}

const PUBLIC_BASE = 'https://implantarhprpro.com/abastecimento';

const QRCard: React.FC<{ vale: Vale }> = ({ vale }) => {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    const url = `${PUBLIC_BASE}/${vale.codigo}`;
    QRCodeLib.toCanvas(ref.current, url, { width: 320, margin: 1, errorCorrectionLevel: 'M' });
  }, [vale.codigo]);

  return (
    <div className="qr-card border-2 border-slate-800 rounded-2xl p-4 bg-white text-slate-900 flex flex-col items-center text-center break-inside-avoid"
      style={{ pageBreakInside: 'avoid' }}>
      <div className="text-2xl font-black tracking-tight">TOPAC</div>
      <div className="text-[10px] font-bold uppercase tracking-widest text-slate-600 mb-2">
        Autorização de Abastecimento
      </div>
      {vale.posto_nome && (
        <div className="text-sm font-semibold leading-tight">{vale.posto_nome}</div>
      )}
      {vale.posto_cnpj && (
        <div className="text-[10px] text-slate-500">CNPJ: {vale.posto_cnpj}</div>
      )}
      {vale.posto_endereco && (
        <div className="text-[10px] text-slate-500 mb-2">{vale.posto_endereco}</div>
      )}
      <canvas ref={ref} className="my-2" />
      <div className="font-mono text-base font-bold tracking-wider">{vale.codigo}</div>
      <div className="text-[9px] text-slate-500 mt-2 px-2 leading-tight">
        Escaneie o QR Code, informe os dados e tire foto da bomba e do painel.
      </div>
    </div>
  );
};

const ImprimirQRCombustivelPage: React.FC = () => {
  const [vales, setVales] = useState<Vale[]>([]);
  const [loading, setLoading] = useState(true);
  const [search] = useSearchParams();

  useEffect(() => {
    (async () => {
      const codigosParam = search.get('codigos');
      let query = supabase
        .from('vales_combustivel')
        .select('id, codigo, posto_nome, posto_cnpj, posto_endereco, status')
        .like('codigo', 'TOPAC-ABAST-%')
        .is('deleted_at', null)
        .order('codigo');

      if (codigosParam) {
        const lista = codigosParam.split(',').map((s) => s.trim()).filter(Boolean);
        query = supabase
          .from('vales_combustivel')
          .select('id, codigo, posto_nome, posto_cnpj, posto_endereco, status')
          .in('codigo', lista);
      }

      const { data } = await query;
      setVales((data as any) || []);
      setLoading(false);
    })();
  }, [search]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100">
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
          .qr-grid { gap: 12px !important; }
        }
        @page { size: A4; margin: 10mm; }
      `}</style>

      <div className="no-print bg-white border-b sticky top-0 z-10 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to="/admin/combustivel">
            <Button variant="outline" size="sm"><ArrowLeft className="w-4 h-4 mr-1" /> Voltar</Button>
          </Link>
          <div>
            <h1 className="font-bold">Impressão de QR Codes TOPAC-ABAST</h1>
            <p className="text-xs text-muted-foreground">{vales.length} autorização(ões) prontas para impressão</p>
          </div>
        </div>
        <Button onClick={() => window.print()}><Printer className="w-4 h-4 mr-2" /> Imprimir</Button>
      </div>

      <div className="p-6">
        <div className="qr-grid grid grid-cols-2 md:grid-cols-3 gap-4 max-w-5xl mx-auto">
          {vales.map((v) => <QRCard key={v.id} vale={v} />)}
        </div>
        {vales.length === 0 && (
          <p className="text-center text-muted-foreground mt-12">Nenhuma autorização TOPAC-ABAST encontrada.</p>
        )}
      </div>
    </div>
  );
};

export default ImprimirQRCombustivelPage;
