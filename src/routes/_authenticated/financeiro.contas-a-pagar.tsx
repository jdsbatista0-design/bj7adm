import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { from, asRows } from "@/integrations/supabase/db";
import type { ContaAPagarRow } from "@/integrations/supabase/database";
import { useEmpresas, useCategorias } from "@/hooks/use-refs";
import { ContaAPagarDialog } from "@/components/financeiro/ContaAPagarDialog";
import { MarcarPagoPopover } from "@/components/financeiro/MarcarPagoPopover";
import { pagarConta, estornarPagamento, excluirConta } from "@/lib/contas-a-pagar";

import { PageShell } from "@/components/bj7/PageShell";
import { KpiCard } from "@/components/bj7/KpiCard";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Plus, CheckCircle2, Trash2, Pencil, AlertTriangle,
  ChevronLeft, ChevronRight, Undo2, ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell,
} from "recharts";

export const Route = createFileRoute("/_authenticated/financeiro/contas-a-pagar")({
  component: ContasAPagarPage,
});

type Status = "todos" | "vencer" | "atrasadas" | "pagas";
type Periodo = "mes" | "30d" | "90d" | "12m";

function brl(n: number | null | undefined) {
  return (n ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function brlCompact(n: number) {
  if (Math.abs(n) >= 1000) return `${(n / 1000).toFixed(0)}k`;
  return String(Math.round(n));
}
function formatDate(iso: string | null | undefined) {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}
function pad(n: number) { return String(n).padStart(2, "0"); }
function isoOf(d: Date) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
function startOfMonth(y: number, m: number) { return isoOf(new Date(y, m, 1)); }
function endOfMonth(y: number, m: number) { return isoOf(new Date(y, m + 1, 0)); }
function addDays(iso: string, days: number) {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + days);
  return isoOf(d);
}

const MESES_PT = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

function ContasAPagarPage() {
  const qc = useQueryClient();
  const empresas = useEmpresas();
  const categorias = useCategorias();

  const now = new Date();
  const [ano, setAno] = useState(now.getFullYear());
  const [mes, setMes] = useState(now.getMonth()); // 0-indexed
  const [periodo, setPeriodo] = useState<Periodo>("mes");
  const [status, setStatus] = useState<Status>("todos");
  const [empresaId, setEmpresaId] = useState<string>("0");
  const [categoriaId, setCategoriaId] = useState<string>("0");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ContaAPagarRow | null>(null);
  const [delTarget, setDelTarget] = useState<ContaAPagarRow | null>(null);

  const todayIso = isoOf(new Date());

  // Range efetivo conforme periodo
  const { dataDe, dataAte, titulo } = useMemo(() => {
    if (periodo === "mes") {
      return {
        dataDe: startOfMonth(ano, mes),
        dataAte: endOfMonth(ano, mes),
        titulo: `${MESES_PT[mes]} ${ano}`,
      };
    }
    if (periodo === "30d") {
      return { dataDe: todayIso, dataAte: addDays(todayIso, 30), titulo: "Próximos 30 dias" };
    }
    if (periodo === "90d") {
      return { dataDe: todayIso, dataAte: addDays(todayIso, 90), titulo: "Próximos 90 dias" };
    }
    // 12m: 6 meses atrás → 6 à frente
    const ini = startOfMonth(now.getFullYear(), now.getMonth() - 5);
    const fim = endOfMonth(now.getFullYear(), now.getMonth() + 6);
    return { dataDe: ini, dataAte: fim, titulo: "12 meses" };
  }, [periodo, ano, mes]);

  // === Contas a pagar do período ===
  const qContas = useQuery({
    queryKey: ["contas_a_pagar", { dataDe, dataAte, empresaId }],
    queryFn: async () => {
      let qb = from("contas_a_pagar")
        .select("*")
        .gte("vencimento", dataDe)
        .lte("vencimento", dataAte)
        .order("vencimento", { ascending: true })
        .limit(5000);
      if (empresaId !== "0") qb = qb.eq("empresa_id", Number(empresaId));
      const r = await qb;
      if (r.error) throw r.error;
      return asRows("contas_a_pagar", r.data);
    },
  });

  // === Despesas históricas (lançamentos) — mesmas fontes do DRE ===
  const qLanc = useQuery({
    queryKey: ["lancamentos", "despesas", { dataDe, dataAte, empresaId }],
    queryFn: async () => {
      let qb = from("lancamentos")
        .select("id, data, descricao, empresa_id, categoria_id, valor, tipo, origem_classificacao")
        .eq("tipo", "Despesa")
        .gte("data", dataDe)
        .lte("data", dataAte)
        .order("data", { ascending: true })
        .limit(10000);
      if (empresaId !== "0") qb = qb.eq("empresa_id", Number(empresaId));
      const r = await qb;
      if (r.error) throw r.error;
      return (r.data ?? []) as Array<{
        id: number; data: string; descricao: string | null;
        empresa_id: number; categoria_id: number | null;
        valor: number; tipo: string; origem_classificacao: string | null;
      }>;
    },
  });

  // === Unifica em linhas únicas ===
  type UnifiedRow = {
    key: string;
    source: "conta" | "lanc";
    data: string;
    descricao: string;
    empresa_id: number | null;
    categoria_id: number | null;
    valor: number;
    valor_pago: number | null;
    pago: boolean;
    atrasada: boolean;
    lancamento_id: number | null;
    conta?: ContaAPagarRow;
  };

  const unified = useMemo<UnifiedRow[]>(() => {
    const out: UnifiedRow[] = [];
    const linkedLancIds = new Set<number>();
    for (const c of qContas.data ?? []) {
      if (c.lancamento_id) linkedLancIds.add(c.lancamento_id);
      const atrasada = !c.pago && c.vencimento < todayIso;
      out.push({
        key: `c-${c.id}`,
        source: "conta",
        data: c.pago && c.data_pagamento ? c.data_pagamento.slice(0, 10) : c.vencimento,
        descricao: c.descricao || "",
        empresa_id: c.empresa_id,
        categoria_id: c.categoria_id,
        valor: Number(c.valor || 0),
        valor_pago: c.valor_pago == null ? null : Number(c.valor_pago),
        pago: !!c.pago,
        atrasada,
        lancamento_id: c.lancamento_id ?? null,
        conta: c,
      });
    }
    for (const l of qLanc.data ?? []) {
      if (linkedLancIds.has(l.id)) continue;
      out.push({
        key: `l-${l.id}`,
        source: "lanc",
        data: l.data.slice(0, 10),
        descricao: l.descricao || "Despesa",
        empresa_id: l.empresa_id,
        categoria_id: l.categoria_id,
        valor: Number(l.valor || 0),
        valor_pago: Number(l.valor || 0),
        pago: true,
        atrasada: false,
        lancamento_id: l.id,
      });
    }
    out.sort((a, b) => a.data.localeCompare(b.data));
    return out;
  }, [qContas.data, qLanc.data, todayIso]);

  const rows = useMemo(() => {
    if (status === "todos") return unified;
    if (status === "vencer") return unified.filter(r => !r.pago && !r.atrasada);
    if (status === "atrasadas") return unified.filter(r => r.atrasada);
    return unified.filter(r => r.pago);
  }, [unified, status]);

  const isLoading = qContas.isLoading || qLanc.isLoading;

  // === Timeline (12 meses fixos) — contas + lançamentos despesa ===
  const timelineRange = useMemo(() => {
    const ini = startOfMonth(now.getFullYear(), now.getMonth() - 5);
    const fim = endOfMonth(now.getFullYear(), now.getMonth() + 6);
    return { ini, fim };
  }, []);

  const tlContasQ = useQuery({
    queryKey: ["contas_a_pagar", "timeline", empresaId, timelineRange.ini, timelineRange.fim],
    queryFn: async () => {
      let qb = from("contas_a_pagar")
        .select("vencimento, valor, valor_pago, pago, data_pagamento, lancamento_id")
        .gte("vencimento", timelineRange.ini)
        .lte("vencimento", timelineRange.fim)
        .limit(10000);
      if (empresaId !== "0") qb = qb.eq("empresa_id", Number(empresaId));
      const r = await qb;
      if (r.error) throw r.error;
      return r.data as Array<{ vencimento: string; valor: number; valor_pago: number | null; pago: boolean; data_pagamento: string | null; lancamento_id: number | null }>;
    },
  });

  const tlLancQ = useQuery({
    queryKey: ["lancamentos", "timeline-despesas", empresaId, timelineRange.ini, timelineRange.fim],
    queryFn: async () => {
      let qb = from("lancamentos")
        .select("id, data, valor")
        .eq("tipo", "Despesa")
        .gte("data", timelineRange.ini)
        .lte("data", timelineRange.fim)
        .limit(20000);
      if (empresaId !== "0") qb = qb.eq("empresa_id", Number(empresaId));
      const r = await qb;
      if (r.error) throw r.error;
      return (r.data ?? []) as Array<{ id: number; data: string; valor: number }>;
    },
  });

  const timelineData = useMemo(() => {
    const buckets: Record<string, { key: string; ano: number; mes: number; label: string; aVencer: number; atrasadas: number; pagas: number; total: number }> = {};
    for (let i = -5; i <= 6; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const y = d.getFullYear(); const m = d.getMonth();
      const key = `${y}-${pad(m + 1)}`;
      buckets[key] = { key, ano: y, mes: m, label: `${MESES_PT[m]}/${String(y).slice(-2)}`, aVencer: 0, atrasadas: 0, pagas: 0, total: 0 };
    }
    const linked = new Set<number>();
    for (const r of tlContasQ.data ?? []) {
      const key = r.vencimento.slice(0, 7);
      const b = buckets[key]; if (!b) continue;
      const v = Number(r.valor || 0);
      if (r.lancamento_id) linked.add(r.lancamento_id);
      if (r.pago) b.pagas += Number(r.valor_pago ?? r.valor ?? 0);
      else if (r.vencimento < todayIso) b.atrasadas += v;
      else b.aVencer += v;
      b.total += v;
    }
    for (const l of tlLancQ.data ?? []) {
      if (linked.has(l.id)) continue;
      const key = l.data.slice(0, 7);
      const b = buckets[key]; if (!b) continue;
      const v = Number(l.valor || 0);
      b.pagas += v;
      b.total += v;
    }
    return Object.values(buckets);
  }, [tlContasQ.data, tlLancQ.data, todayIso]);

  // KPIs (sobre unified)
  const kpis = useMemo(() => {
    const aVencer = unified.filter(r => !r.pago && !r.atrasada).reduce((a, b) => a + b.valor, 0);
    const atrasadas = unified.filter(r => r.atrasada).reduce((a, b) => a + b.valor, 0);
    const pagas = unified.filter(r => r.pago).reduce((a, b) => a + (b.valor_pago ?? b.valor), 0);
    return { aVencer, atrasadas, pagas, saldo: aVencer + atrasadas };
  }, [unified]);

  const empresaNome = (id: number | null) =>
    id ? empresas.data?.find(e => e.id === id)?.nome ?? `#${id}` : "—";
  const categoriaNome = (id: number | null) =>
    id ? categorias.data?.find(c => c.id === id)?.nome ?? `#${id}` : "—";

  // Mutations
  const pagar = useMutation({
    mutationFn: (args: { conta: ContaAPagarRow; input: { dataPagamento: string; valorPago: number; empresaId: number; categoriaId: number | null } }) =>
      pagarConta(args.conta, args.input),
    onSuccess: () => {
      toast.success("Conta paga e lançada no DRE");
      qc.invalidateQueries({ queryKey: ["contas_a_pagar"] });
      qc.invalidateQueries({ queryKey: ["lancamentos"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const estornar = useMutation({
    mutationFn: (row: ContaAPagarRow) => estornarPagamento(row),
    onSuccess: () => {
      toast.success("Pagamento estornado");
      qc.invalidateQueries({ queryKey: ["contas_a_pagar"] });
      qc.invalidateQueries({ queryKey: ["lancamentos"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: (row: ContaAPagarRow) => excluirConta(row),
    onSuccess: () => {
      toast.success("Excluída");
      setDelTarget(null);
      qc.invalidateQueries({ queryKey: ["contas_a_pagar"] });
      qc.invalidateQueries({ queryKey: ["lancamentos"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function navMes(delta: number) {
    let m = mes + delta;
    let y = ano;
    while (m < 0) { m += 12; y -= 1; }
    while (m > 11) { m -= 12; y += 1; }
    setMes(m); setAno(y); setPeriodo("mes");
  }

  return (
    <PageShell
      title="Contas a Pagar"
      description="Planejamento de caixa · integrado ao DRE"
      actions={
        <Button size="sm" onClick={() => { setEditing(null); setDialogOpen(true); }}>
          <Plus className="h-4 w-4 mr-2" /> Nova conta
        </Button>
      }
    >
      {/* === KPIs === */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label={`A vencer · ${titulo}`} value={isLoading ? "..." : brl(kpis.aVencer)} />
        <KpiCard label={`Atrasadas · ${titulo}`} value={isLoading ? "..." : brl(kpis.atrasadas)} status={kpis.atrasadas > 0 ? "critico" : "neutral"} />
        <KpiCard label={`Pagas · ${titulo}`} value={isLoading ? "..." : brl(kpis.pagas)} status="ok" />
        <KpiCard label="Saldo previsto" value={isLoading ? "..." : brl(kpis.saldo)} hint="A vencer + atrasadas" />
      </div>

      {/* === Timeline === */}
      <div className="rounded-xl bg-card ring-1 ring-white/5 p-4">
        <div className="flex items-center justify-between mb-2">
          <div>
            <p className="text-sm font-medium">Fluxo mensal</p>
            <p className="text-[11px] text-muted-foreground">6 meses atrás → 6 meses à frente · clique numa barra</p>
          </div>
          <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-emerald-500/70 inline-block" /> Pagas</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-destructive/70 inline-block" /> Atrasadas</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-primary/70 inline-block" /> A vencer</span>
          </div>
        </div>
        <div className="h-[160px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={timelineData} margin={{ top: 4, right: 4, left: -10, bottom: 0 }}>
              <XAxis dataKey="label" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => brlCompact(Number(v))} />
              <Tooltip
                cursor={{ fill: "rgba(255,255,255,0.04)" }}
                contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", fontSize: 11, borderRadius: 8 }}
                formatter={(v: number, name: string) => [brl(Number(v)), name]}
              />
              <Bar dataKey="pagas" stackId="a" fill="hsl(160 70% 45% / 0.7)" name="Pagas" />
              <Bar dataKey="atrasadas" stackId="a" fill="hsl(0 70% 55% / 0.7)" name="Atrasadas" />
              <Bar
                dataKey="aVencer"
                stackId="a"
                fill="hsl(var(--primary) / 0.7)"
                name="A vencer"
                cursor="pointer"
                onClick={(d: { ano?: number; mes?: number }) => {
                  if (typeof d.ano === "number" && typeof d.mes === "number") {
                    setAno(d.ano); setMes(d.mes); setPeriodo("mes");
                  }
                }}
              >
                {timelineData.map((d) => (
                  <Cell
                    key={d.key}
                    opacity={periodo === "mes" && d.ano === ano && d.mes === mes ? 1 : 0.65}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* === Barra de período + filtros === */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-1 rounded-md ring-1 ring-white/10 p-0.5">
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => navMes(-1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <button
            onClick={() => { const d = new Date(); setAno(d.getFullYear()); setMes(d.getMonth()); setPeriodo("mes"); }}
            className={cn(
              "px-2 h-7 text-xs rounded hover:bg-white/5",
              periodo === "mes" && "text-foreground font-medium"
            )}
          >
            {titulo}
          </button>
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => navMes(1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex items-center gap-1">
          <Button variant={periodo === "30d" ? "secondary" : "ghost"} size="sm" className="h-7 text-xs" onClick={() => setPeriodo("30d")}>30d</Button>
          <Button variant={periodo === "90d" ? "secondary" : "ghost"} size="sm" className="h-7 text-xs" onClick={() => setPeriodo("90d")}>90d</Button>
          <Button variant={periodo === "12m" ? "secondary" : "ghost"} size="sm" className="h-7 text-xs" onClick={() => setPeriodo("12m")}>12m</Button>
        </div>

        <Tabs value={status} onValueChange={(v) => setStatus(v as Status)}>
          <TabsList>
            <TabsTrigger value="todos">Todos</TabsTrigger>
            <TabsTrigger value="vencer">A vencer</TabsTrigger>
            <TabsTrigger value="atrasadas">Atrasadas</TabsTrigger>
            <TabsTrigger value="pagas">Pagas</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex-1" />
        <Select value={empresaId} onValueChange={setEmpresaId}>
          <SelectTrigger className="h-9 w-[200px]"><SelectValue placeholder="Empresa" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="0">Todas as empresas</SelectItem>
            {empresas.data?.map(e => (
              <SelectItem key={e.id} value={String(e.id)}>{e.nome}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* === Tabela === */}
      <div className="rounded-xl bg-card ring-1 ring-white/5 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Vencimento</TableHead>
              <TableHead>Descrição</TableHead>
              <TableHead>Empresa</TableHead>
              <TableHead>Categoria</TableHead>
              <TableHead className="text-right">Valor</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[180px] text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={7}><Skeleton className="h-6" /></TableCell>
                </TableRow>
              ))
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-8">
                  Nenhuma conta no período
                </TableCell>
              </TableRow>
            ) : (
              rows.map(r => {
                const isLanc = r.source === "lanc";
                const c = r.conta;
                return (
                  <TableRow key={r.key}>
                    <TableCell className={cn("tabular", r.atrasada && "text-destructive font-medium")}>
                      {r.atrasada && <AlertTriangle className="h-3 w-3 inline mr-1" />}
                      {formatDate(r.data)}
                    </TableCell>
                    <TableCell className="max-w-[280px] truncate">
                      <div className="flex items-center gap-2">
                        <span className="truncate">{r.descricao}</span>
                        {r.lancamento_id && (
                          <Link
                            to="/financeiro"
                            search={{ tab: "lancamentos" as never } as never}
                            title={`Lançamento #${r.lancamento_id}`}
                          >
                            <Badge className="bg-emerald-500/10 text-emerald-300 border-emerald-500/20 text-[10px] py-0 h-4 gap-0.5">
                              DRE <ExternalLink className="h-2.5 w-2.5" />
                            </Badge>
                          </Link>
                        )}
                        {isLanc && (
                          <Badge variant="outline" className="text-[10px] py-0 h-4">histórico</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{empresaNome(r.empresa_id)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{categoriaNome(r.categoria_id)}</TableCell>
                    <TableCell className="text-right tabular">{brl(r.valor_pago ?? r.valor)}</TableCell>
                    <TableCell>
                      {r.pago ? (
                        <Badge className="bg-emerald-500/15 text-emerald-300 border-emerald-500/30">Pago</Badge>
                      ) : r.atrasada ? (
                        <Badge className="bg-destructive/15 text-destructive border-destructive/30">Atrasada</Badge>
                      ) : (
                        <Badge variant="outline">A vencer</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {isLanc || !c ? (
                          <span className="text-[10px] text-muted-foreground pr-2">só leitura</span>
                        ) : (
                          <>
                            {!c.pago ? (
                              <MarcarPagoPopover
                                conta={c}
                                onConfirm={async (input) => { await pagar.mutateAsync({ conta: c, input }); }}
                                trigger={
                                  <Button size="sm" variant="ghost" title="Marcar como paga e lançar">
                                    <CheckCircle2 className="h-4 w-4" />
                                  </Button>
                                }
                              />
                            ) : (
                              <Button size="sm" variant="ghost" onClick={() => estornar.mutate(c)} title="Estornar pagamento">
                                <Undo2 className="h-4 w-4" />
                              </Button>
                            )}
                            <Button size="sm" variant="ghost" onClick={() => { setEditing(c); setDialogOpen(true); }}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => setDelTarget(c)}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <ContaAPagarDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editing={editing}
        onSaved={() => {
          qc.invalidateQueries({ queryKey: ["contas_a_pagar"] });
          qc.invalidateQueries({ queryKey: ["lancamentos"] });
        }}
      />

      <AlertDialog open={!!delTarget} onOpenChange={(o) => !o && setDelTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir conta?</AlertDialogTitle>
            <AlertDialogDescription>
              "{delTarget?.descricao}" — esta ação não pode ser desfeita.
              {delTarget?.lancamento_id && " O lançamento vinculado no DRE também será removido."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => delTarget && del.mutate(delTarget)}>
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageShell>
  );
}
