import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Fuel, QrCode, Lock, Unlock, Plus, Printer, FileSpreadsheet } from "lucide-react";
import QRCode from "qrcode";

interface Mecanico {
  id: string; nome: string; empresa: string | null; filial: string | null; funcao: string | null;
}
interface Vale {
  id: string; codigo: string; mecanico_nome: string; empresa: string | null;
  filial: string | null; placa: string | null; status: string; acesso_externo_id: string | null;
}

export default function CombustivelQRAdminPage() {
  const [mecs, setMecs] = useState<Mecanico[]>([]);
  const [vales, setVales] = useState<Vale[]>([]);
  const [loading, setLoading] = useState(true);
  const [qrAberto, setQrAberto] = useState<Vale | null>(null);
  const [qrSvg, setQrSvg] = useState<string>("");

  // relatório
  const [comp, setComp] = useState(new Date().toISOString().slice(0,7));
  const [empresaF, setEmpresaF] = useState("");
  const [relat, setRelat] = useState<any>(null);
  const [carRel, setCarRel] = useState(false);

  const carregar = async () => {
    setLoading(true);
    const [m, v] = await Promise.all([
      supabase.from("acessos_externos" as any)
        .select("id,nome,empresa,filial,funcao")
        .eq("modulo","mecanico").eq("perfil_acesso","mecanico_externo").order("nome"),
      supabase.from("vales_combustivel" as any)
        .select("id,codigo,mecanico_nome,empresa,filial,placa,status,acesso_externo_id")
        .is("deleted_at", null).order("mecanico_nome"),
    ]);
    setMecs((m.data as any) || []);
    setVales((v.data as any) || []);
    setLoading(false);
  };
  useEffect(() => { carregar(); }, []);

  const valePor = useMemo(() => {
    const map = new Map<string, Vale>();
    vales.forEach(v => v.acesso_externo_id && map.set(v.acesso_externo_id, v));
    return map;
  }, [vales]);

  const gerar = async (acessoId: string) => {
    const { data, error } = await supabase.rpc("admin_combustivel_qr_gerar" as any, { p_acesso_id: acessoId });
    const r = data as any;
    if (error || !r?.ok) { toast.error(r?.error || error?.message || "Erro"); return; }
    toast.success(r.novo ? "QR criado" : "QR já existia");
    carregar();
  };

  const toggle = async (vale: Vale) => {
    const bloquear = vale.status === "ativo";
    const { data, error } = await supabase.rpc("admin_combustivel_qr_toggle" as any, {
      p_vale_id: vale.id, p_bloquear: bloquear,
    });
    const r = data as any;
    if (error || !r?.ok) { toast.error("Erro"); return; }
    toast.success(bloquear ? "Bloqueado" : "Liberado");
    carregar();
  };

  const verQr = async (vale: Vale) => {
    setQrAberto(vale);
    const dataUrl = await QRCode.toDataURL(vale.codigo, { width: 320, margin: 2 });
    setQrSvg(dataUrl);
  };

  const imprimirQr = () => {
    if (!qrAberto || !qrSvg) return;
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(`<html><head><title>QR ${qrAberto.codigo}</title></head>
      <body style="font-family:Arial;text-align:center;padding:40px">
        <h2>${qrAberto.mecanico_nome}</h2>
        <p>${qrAberto.empresa || ''} ${qrAberto.filial ? '· ' + qrAberto.filial : ''}</p>
        <img src="${qrSvg}" />
        <p style="font-family:monospace;margin-top:8px">${qrAberto.codigo}</p>
        <p style="font-size:11px;color:#666">QR vitalício de abastecimento</p>
      </body></html>`);
    w.document.close(); w.focus(); setTimeout(() => w.print(), 300);
  };

  const gerarRelatorio = async () => {
    setCarRel(true);
    const { data, error } = await supabase.rpc("admin_combustivel_relatorio_mensal" as any, {
      p_competencia: comp,
      p_empresa: empresaF || null,
      p_filial: null, p_acesso_id: null, p_placa: null,
    });
    setCarRel(false);
    const r = data as any;
    if (error || !r?.ok) { toast.error("Erro ao gerar"); return; }
    setRelat(r);
  };

  const exportarCsv = () => {
    if (!relat?.linhas?.length) return;
    const head = ["Mecânico","Empresa","Filial","Placa","Qtd","Litros","Valor","R$/L","KM mín","KM máx"];
    const rows = relat.linhas.map((l: any) => [
      l.mecanico_nome, l.empresa||"", l.filial||"", l.placa||"",
      l.qtd_abastecimentos, l.total_litros, l.total_valor, l.media_valor_litro,
      l.km_min ?? "", l.km_max ?? "",
    ]);
    const csv = [head, ...rows].map(r => r.map((c: any) => `"${String(c).replace(/"/g,'""')}"`).join(";")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `combustivel-${comp}.csv`;
    a.click();
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Fuel className="w-7 h-7 text-amber-600" />
        <div>
          <h1 className="text-2xl font-bold">Combustível QR — Mecânicos</h1>
          <p className="text-sm text-muted-foreground">Gere QR vitalício, bloqueie/desbloqueie e gere relatório mensal.</p>
        </div>
      </div>

      <Tabs defaultValue="qr">
        <TabsList>
          <TabsTrigger value="qr">QR dos Mecânicos</TabsTrigger>
          <TabsTrigger value="rel">Relatório Mensal</TabsTrigger>
        </TabsList>

        <TabsContent value="qr">
          <Card>
            <CardHeader><CardTitle>Mecânicos ({mecs.length})</CardTitle></CardHeader>
            <CardContent>
              {loading ? "Carregando..." : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Mecânico</TableHead>
                      <TableHead>Empresa / Filial</TableHead>
                      <TableHead>QR Code</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {mecs.map(m => {
                      const v = valePor.get(m.id);
                      return (
                        <TableRow key={m.id}>
                          <TableCell className="font-medium">{m.nome}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {m.empresa || '-'} {m.filial ? `· ${m.filial}` : ''}
                          </TableCell>
                          <TableCell>
                            {v ? <code className="bg-muted px-2 py-0.5 rounded text-xs">{v.codigo}</code>
                               : <span className="text-xs text-muted-foreground">— sem QR —</span>}
                          </TableCell>
                          <TableCell>
                            {v ? (v.status === 'ativo'
                              ? <Badge className="bg-green-500/10 text-green-700 border-green-500/20">Ativo</Badge>
                              : <Badge variant="destructive">{v.status}</Badge>)
                            : <Badge variant="outline">—</Badge>}
                          </TableCell>
                          <TableCell className="text-right space-x-1">
                            {!v && (
                              <Button size="sm" variant="outline" onClick={() => gerar(m.id)}>
                                <Plus className="w-3.5 h-3.5 mr-1" /> Gerar QR
                              </Button>
                            )}
                            {v && (
                              <>
                                <Button size="sm" variant="ghost" onClick={() => verQr(v)} title="Ver QR">
                                  <QrCode className="w-4 h-4" />
                                </Button>
                                <Button size="sm" variant="ghost" onClick={() => toggle(v)}
                                  title={v.status === 'ativo' ? 'Bloquear' : 'Liberar'}>
                                  {v.status === 'ativo' ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                                </Button>
                              </>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="rel">
          <Card>
            <CardHeader><CardTitle>Filtros</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground">Competência</label>
                  <Input type="month" value={comp} onChange={e => setComp(e.target.value)} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Empresa (opcional)</label>
                  <Input value={empresaF} onChange={e => setEmpresaF(e.target.value)} placeholder="ex: TOPAC MATRIZ" />
                </div>
                <div className="flex items-end gap-2">
                  <Button onClick={gerarRelatorio} disabled={carRel}>Gerar relatório</Button>
                  <Button variant="outline" onClick={exportarCsv} disabled={!relat?.linhas?.length}>
                    <FileSpreadsheet className="w-4 h-4 mr-1" /> CSV
                  </Button>
                  <Button variant="outline" onClick={() => window.print()} disabled={!relat?.linhas?.length}>
                    <Printer className="w-4 h-4 mr-1" /> Imprimir
                  </Button>
                </div>
              </div>

              {relat && (
                <div className="space-y-2">
                  <div className="grid grid-cols-3 gap-3 text-sm">
                    <Card className="p-3"><div className="text-xs text-muted-foreground">Abastecimentos</div><div className="text-xl font-bold">{relat.totais?.qtd || 0}</div></Card>
                    <Card className="p-3"><div className="text-xs text-muted-foreground">Litros</div><div className="text-xl font-bold">{Number(relat.totais?.litros||0).toFixed(2)}</div></Card>
                    <Card className="p-3"><div className="text-xs text-muted-foreground">Valor</div><div className="text-xl font-bold">R$ {Number(relat.totais?.valor||0).toFixed(2)}</div></Card>
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Mecânico</TableHead><TableHead>Empresa</TableHead><TableHead>Placa</TableHead>
                        <TableHead className="text-right">Qtd</TableHead>
                        <TableHead className="text-right">Litros</TableHead>
                        <TableHead className="text-right">Valor</TableHead>
                        <TableHead className="text-right">R$/L</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {relat.linhas.map((l: any, i: number) => (
                        <TableRow key={i}>
                          <TableCell>{l.mecanico_nome}</TableCell>
                          <TableCell>{l.empresa || '-'}</TableCell>
                          <TableCell>{l.placa || '-'}</TableCell>
                          <TableCell className="text-right">{l.qtd_abastecimentos}</TableCell>
                          <TableCell className="text-right">{Number(l.total_litros).toFixed(2)}</TableCell>
                          <TableCell className="text-right">R$ {Number(l.total_valor).toFixed(2)}</TableCell>
                          <TableCell className="text-right">{Number(l.media_valor_litro).toFixed(3)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={!!qrAberto} onOpenChange={o => !o && setQrAberto(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>QR Code · {qrAberto?.mecanico_nome}</DialogTitle></DialogHeader>
          {qrSvg && <img src={qrSvg} alt="QR" className="w-full" />}
          <div className="text-center text-xs text-muted-foreground font-mono">{qrAberto?.codigo}</div>
          <Button onClick={imprimirQr}><Printer className="w-4 h-4 mr-2" /> Imprimir</Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
