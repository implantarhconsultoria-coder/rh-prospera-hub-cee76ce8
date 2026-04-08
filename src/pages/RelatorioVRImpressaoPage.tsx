import React, { useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useApp } from '@/context/AppContext';
import { getWorkingDays } from '@/lib/workingDays';
import { formatCurrency } from '@/lib/calculations';

const RelatorioVRImpressaoPage: React.FC = () => {
  const { companies, employees, entries, getOrCreateEntries } = useApp();
  const [searchParams] = useSearchParams();
  const companyId = searchParams.get('empresa') || '';
  const competencia = searchParams.get('competencia') || new Date().toISOString().slice(0, 7);

  const company = companies.find(c => c.id === companyId);
  const diasUteis = getWorkingDays(competencia);

  useEffect(() => {
    if (companyId && competencia) getOrCreateEntries(companyId, competencia);
  }, [companyId, competencia]);

  const compEmps = employees.filter(e => e.companyId === companyId && e.status === 'ativo' && e.categoria === 'operacional' && e.vrAtivo);
  const compEntries = entries.filter(e => e.companyId === companyId && e.competencia === competencia);

  const rows = useMemo(() => compEmps.map(emp => {
    const entry = compEntries.find(e => e.employeeId === emp.id);
    const faltasDias = entry?.faltasDias || 0;
    const vrDias = entry?.vrDias ?? diasUteis;
    const vrDiasEfetivos = Math.max(0, vrDias - faltasDias);
    const valorBase = emp.vrDiario * vrDias;
    const desconto = emp.vrDiario * faltasDias;
    const valorFinal = emp.vrDiario * vrDiasEfetivos;
    return { emp, vrDiasEfetivos, valorBase, desconto, valorFinal, motivo: faltasDias > 0 ? `${faltasDias} falta(s)` : '' };
  }), [compEmps, compEntries, diasUteis]);

  const totalBase = rows.reduce((s, r) => s + r.valorBase, 0);
  const totalDesc = rows.reduce((s, r) => s + r.desconto, 0);
  const totalFinal = rows.reduce((s, r) => s + r.valorFinal, 0);

  const competenciaLabel = (() => {
    const [y, m] = competencia.split('-');
    const meses = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
    return `${meses[Number(m) - 1]} / ${y}`;
  })();

  const emissaoDate = (() => {
    const [y, m] = competencia.split('-');
    const lastDay = new Date(Number(y), Number(m), 0);
    return lastDay.toLocaleDateString('pt-BR');
  })();

  if (!company) return <div className="p-10 text-center">Empresa não encontrada.</div>;

  return (
    <>
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #vr-print-area, #vr-print-area * { visibility: visible; }
          #vr-print-area { position: absolute; left: 0; top: 0; width: 100%; }
          .no-print { display: none !important; }
        }
      `}</style>
      <div className="bg-white text-black min-h-screen print:bg-white" style={{ fontFamily: "'Segoe UI', Arial, sans-serif" }}>
        <div className="no-print flex items-center gap-3 px-8 py-3 bg-gray-100 border-b">
          <button onClick={() => window.history.length > 1 ? window.history.back() : window.location.href = '/relatorio-vr'}
            className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
            ← Voltar
          </button>
          <button onClick={() => window.print()}
            className="px-4 py-2 text-sm font-medium bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors">
            🖨 Imprimir / PDF
          </button>
        </div>
        <div id="vr-print-area" className="max-w-[210mm] mx-auto px-8 py-6 print:px-6 print:py-4" style={{ fontSize: '11px' }}>
          <div className="border-b-2 border-black pb-3 mb-4">
            <div className="flex justify-between items-start">
              <div>
                <h1 className="text-lg font-bold">{company.name}</h1>
                <p className="text-xs text-gray-600">CNPJ: {company.cnpj}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold">RELATÓRIO DE VALE REFEIÇÃO</p>
                <p className="text-xs">Competência: {competenciaLabel}</p>
                <p className="text-xs">Emissão: {emissaoDate}</p>
                <p className="text-xs">Dias úteis: {diasUteis}</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-2 mb-4">
            {[
              { l: 'Base VR / dia', v: rows.length > 0 ? formatCurrency(rows[0].emp.vrDiario) : '—' },
              { l: 'Total Base', v: formatCurrency(totalBase) },
              { l: 'Total Descontos', v: formatCurrency(totalDesc) },
              { l: 'Total Final', v: formatCurrency(totalFinal) },
            ].map((c, i) => (
              <div key={i} className="border border-gray-400 rounded px-2 py-1 text-center">
                <p className="text-[9px] text-gray-500 uppercase">{c.l}</p>
                <p className="text-xs font-bold">{c.v}</p>
              </div>
            ))}
          </div>

          <table className="w-full border-collapse" style={{ fontSize: '10px' }}>
            <thead>
              <tr className="bg-gray-200">
                {['Nome', 'Função', 'VR/Dia', 'Dias', 'VR Base', 'Desconto', 'Motivo', 'VR Final'].map(h => (
                  <th key={h} className="border border-gray-400 px-2 py-1 text-left font-semibold">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.emp.id} className="even:bg-gray-50">
                  <td className="border border-gray-300 px-2 py-1 font-medium">{r.emp.name}</td>
                  <td className="border border-gray-300 px-2 py-1">{r.emp.cargo}</td>
                  <td className="border border-gray-300 px-2 py-1 text-right">{formatCurrency(r.emp.vrDiario)}</td>
                  <td className="border border-gray-300 px-2 py-1 text-center">{r.vrDiasEfetivos}</td>
                  <td className="border border-gray-300 px-2 py-1 text-right">{formatCurrency(r.valorBase)}</td>
                  <td className="border border-gray-300 px-2 py-1 text-right">{r.desconto > 0 ? formatCurrency(r.desconto) : '—'}</td>
                  <td className="border border-gray-300 px-2 py-1">{r.motivo || '—'}</td>
                  <td className="border border-gray-300 px-2 py-1 text-right font-bold">{formatCurrency(r.valorFinal)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-gray-200 font-bold">
                <td colSpan={4} className="border border-gray-400 px-2 py-1">TOTAIS</td>
                <td className="border border-gray-400 px-2 py-1 text-right">{formatCurrency(totalBase)}</td>
                <td className="border border-gray-400 px-2 py-1 text-right">{formatCurrency(totalDesc)}</td>
                <td className="border border-gray-400 px-2 py-1"></td>
                <td className="border border-gray-400 px-2 py-1 text-right">{formatCurrency(totalFinal)}</td>
              </tr>
            </tfoot>
          </table>

          <div className="mt-6 pt-3 border-t border-gray-400 text-center text-[9px] text-gray-500">
            ImplantaRH ConsultoriaPRO — Topac RH Multiempresa PRO — Relatório gerado em {emissaoDate}
          </div>
        </div>
      </div>
    </>
  );
};

export default RelatorioVRImpressaoPage;
