import { Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/contexts/auth-context";
import { useEmpresas } from "@/hooks/use-refs";
import type { DreConsolidadaRow } from "@/integrations/supabase/database";
import { PageShell, SectionHeader } from "@/components/bj7/PageShell";
import { KpiCard } from "@/components/bj7/KpiCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectSeparator,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";
import { formatBRL, MESES_PT, toLocalIsoDate } from "@/lib/format";
import {
  ArrowRight,
  TrendingUp,
  TrendingDown,
  PiggyBank,
  Percent,
  Building2,
} from "lucide-react";

export function AnaliseView() {
  return <Dashboard />;
}

const MIN_YEAR = 2018;
const STALE = 5 * 60 * 1000;

type PeriodoKey =
  | "mes_atual"
  | "mes_anterior"
  | "ult_3m"
  | "ult_6m"
  | "ult_12m"
  | "ano_atual"
  | `ano_${number}`
  | "personalizado";

const PERIODOS_BASE: { key: PeriodoKey; label: string }[] = [
  { key: "mes_atual", label: "Mês atual" },
  { key: "mes_anterior", label: "Mês anterior" },
  { key: "ult_3m", label: "Últimos 3 meses" },
  { key: "ult_6m", label: "Últimos 6 meses" },
  { key: "ult_12m", label: "Últimos 12 meses" },
  { key: "ano_atual", label: "Ano atual" },
];

function anosDisponiveis(): number[] {
  const atual = new Date().getFullYear();
  const out: number[] = [];
  for (let y = atual; y >= MIN_YEAR; y--) out.push(y);
  return out;
}

function isoDate(d: Date) {
  return toLocalIsoDate(d);
}

function rangesFor(
  p: PeriodoKey,
  custom: { start: string; end: string },
): {
  start: string;
  end: string;
  startPrev: string;
  endPrev: string;
} {
  const hoje = new Date();
  const y = hoje.getFullYear();
  const m = hoje.getMonth();

  let start: Date;
  let end: Date;

  if (p === "mes_atual") {
    start = new Date(y, m, 1);
    end = new Date(y, m + 1, 1);
  } else if (p === "mes_anterior") {
    start = new Date(y, m - 1, 1);
    end = new Date(y, m, 1);
  } else if (p === "ult_3m") {
    start = new Date(y, m - 2, 1);
    end = new Date(y, m + 1, 1);
  } else if (p === "ult_6m") {
    start = new Date(y, m - 5, 1);
    end = new Date(y, m + 1, 1);
  } else if (p === "ult_12m") {
    start = new Date(y, m - 11, 1);
    end = new Date(y, m + 1, 1);
  } else if (p === "ano_atual") {
    start = new Date(y, 0, 1);
    end = new Date(y + 1, 0, 1);
  } else if (typeof p === "string" && p.startsWith("ano_")) {
    const yr = Number(p.slice(4));
    start = new Date(yr, 0, 1);
    end = new Date(yr + 1, 0, 1);
  } else {
    const s = custom.start || `${MIN_YEAR}-01-01`;
    const e = custom.end || isoDate(hoje);
    start = new Date(`${s}T00:00:00`);
    const eDate = new Date(`${e}T00:00:00`);
    // Normaliza para o 1º dia do mês seguinte (mes_ref é o 1º dia do mês).
    end = new Date(eDate.getFullYear(), eDate.getMonth() + 1, 1);
    // alinha start ao 1º dia do mês
    start = new Date(start.getFullYear(), start.getMonth(), 1);
  }

  const ms = end.getTime() - start.getTime();
  const endPrev = new Date(start.getTime());
  const startPrev = new Date(start.getTime() - ms);

  return {
    start: isoDate(start),
    end: isoDate(end),
    startPrev: isoDate(startPrev),
    endPrev: isoDate(endPrev),
  };
}

type EmpresaAgg = {
  rec: number;
  desp: number;
  recAnt: number;
  despAnt: number;
};

/**
 * Busca linhas agregadas da view dre_consolidada para um intervalo de meses.
 * mes_ref é o 1º dia do mês; o intervalo é semi-aberto [start, end).
 */
async function fetchDreRange(opts: {
  start: string;
  end: string;
  empresaIds: number[] | null; // null = todas
}): Promise<DreConsolidadaRow[]> {
  let q = supabase
    .from("dre_consolidada")
    .select("empresa_id,mes_ref,tipo,grupo,valor_total")
    .eq("entra_dre", true)
    .gte("mes_ref", opts.start)
    .lt("mes_ref", opts.end);
  if (opts.empresaIds) {
    if (opts.empresaIds.length === 0) return [];
    q = q.in("empresa_id", opts.empresaIds);
  }
  const r = await q;
  if (r.error) throw r.error;
  return (r.data ?? []) as DreConsolidadaRow[];
}

function Dashboard() {
  const user = useCurrentUser();
  const empresas = useEmpresas();
  const [periodoKey, setPeriodoKey] = useState<PeriodoKey>("mes_atual");
  const hojeISO = isoDate(new Date());
  const [customStart, setCustomStart] = useState<string>(`${MIN_YEAR}-01-01`);
  const [customEnd, setCustomEnd] = useState<string>(hojeISO);

  const periodo = useMemo(
    () => rangesFor(periodoKey, { start: customStart, end: customEnd }),
    [periodoKey, customStart, customEnd],
  );

  const anos = useMemo(() => anosDisponiveis(), []);

  const skipComparison = useMemo(() => {
    if (periodoKey === "personalizado") return true;
    const startD = new Date(periodo.start);
    const endD = new Date(periodo.end);
    const meses =
      (endD.getFullYear() - startD.getFullYear()) * 12 +
      (endD.getMonth() - startD.getMonth());
    return meses >= 24;
  }, [periodoKey, periodo.start, periodo.end]);

  const empresaIds = user.ve_todas_empresas ? null : user.empresas_ids;
  const empresaKey = empresaIds ? empresaIds.join(",") : "all";

  const atualQ = useQuery({
    queryKey: ["dre", "atual", periodo.start, periodo.end, empresaKey],
    queryFn: () =>
      fetchDreRange({ start: periodo.start, end: periodo.end, empresaIds }),
    staleTime: STALE,
    gcTime: 10 * 60 * 1000,
  });

  const antQ = useQuery({
    queryKey: ["dre", "ant", periodo.startPrev, periodo.endPrev, empresaKey],
    enabled: !skipComparison,
    queryFn: () =>
      fetchDreRange({
        start: periodo.startPrev,
        end: periodo.endPrev,
        empresaIds,
      }),
    staleTime: STALE,
    gcTime: 10 * 60 * 1000,
  });

  // Evolução 12m: range fixo, cache mais longo
  const evol12mQ = useQuery({
    queryKey: ["dre", "evol12m", empresaKey],
    queryFn: () => {
      const hoje = new Date();
      const start = new Date(hoje.getFullYear(), hoje.getMonth() - 11, 1);
      const end = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 1);
      return fetchDreRange({
        start: isoDate(start),
        end: isoDate(end),
        empresaIds,
      });
    },
    staleTime: STALE,
    gcTime: 10 * 60 * 1000,
  });

  function sumByTipo(rows: DreConsolidadaRow[], tipo: string) {
    return rows
      .filter((r) => r.tipo === tipo)
      .reduce((s, r) => s + Math.abs(Number(r.valor_total) || 0), 0);
  }

  const consolidado = useMemo(() => {
    const rows = atualQ.data ?? [];
    const rowsAnt = antQ.data ?? [];

    const rec = sumByTipo(rows, "Receita");
    const desp = sumByTipo(rows, "Despesa");
    const lucro = rec - desp;
    const margem = rec > 0 ? (lucro / rec) * 100 : 0;

    const recAnt = sumByTipo(rowsAnt, "Receita");
    const despAnt = sumByTipo(rowsAnt, "Despesa");
    const lucroAnt = recAnt - despAnt;
    const margemAnt = recAnt > 0 ? (lucroAnt / recAnt) * 100 : 0;

    const tr = (cur: number, ant: number) =>
      ant > 0 ? (cur - ant) / ant : null;

    return {
      rec,
      desp,
      lucro,
      margem,
      trendRec: skipComparison ? null : tr(rec, recAnt),
      trendDesp: skipComparison ? null : tr(desp, despAnt),
      trendLucro: skipComparison ? null : tr(lucro, lucroAnt),
      trendMargemPp: skipComparison ? null : margem - margemAnt,
    };
  }, [atualQ.data, antQ.data, skipComparison]);

  const porEmpresa = useMemo(() => {
    const map = new Map<number, EmpresaAgg>();
    const rows = atualQ.data ?? [];
    const rowsAnt = antQ.data ?? [];
    for (const r of rows) {
      const cur = map.get(r.empresa_id) ?? { rec: 0, desp: 0, recAnt: 0, despAnt: 0 };
      const v = Math.abs(Number(r.valor_total) || 0);
      if (r.tipo === "Receita") cur.rec += v;
      else if (r.tipo === "Despesa") cur.desp += v;
      map.set(r.empresa_id, cur);
    }
    for (const r of rowsAnt) {
      const cur = map.get(r.empresa_id) ?? { rec: 0, desp: 0, recAnt: 0, despAnt: 0 };
      const v = Math.abs(Number(r.valor_total) || 0);
      if (r.tipo === "Receita") cur.recAnt += v;
      else if (r.tipo === "Despesa") cur.despAnt += v;
      map.set(r.empresa_id, cur);
    }

    return Array.from(map.entries())
      .map(([empresa_id, v]) => {
        const lucro = v.rec - v.desp;
        const margem = v.rec > 0 ? (lucro / v.rec) * 100 : 0;
        const lucroAnt = v.recAnt - v.despAnt;
        const margemAnt = v.recAnt > 0 ? (lucroAnt / v.recAnt) * 100 : 0;
        const nome =
          empresas.data?.find((e) => e.id === empresa_id)?.nome ??
          `#${empresa_id}`;
        return {
          empresa_id,
          nome,
          rec: v.rec,
          desp: v.desp,
          lucro,
          margem,
          margemAnt,
          deltaMargemPp: margem - margemAnt,
        };
      })
      .sort((a, b) => b.lucro - a.lucro);
  }, [atualQ.data, antQ.data, empresas.data]);

  const evolucao = useMemo(() => {
    const rows = evol12mQ.data ?? [];
    const buckets = new Map<string, { receita: number; despesa: number }>();
    const hoje = new Date();
    for (let i = 11; i >= 0; i--) {
      const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      buckets.set(key, { receita: 0, despesa: 0 });
    }
    for (const r of rows) {
      const key = (r.mes_ref ?? "").slice(0, 7);
      const b = buckets.get(key);
      if (!b) continue;
      const v = Math.abs(Number(r.valor_total) || 0);
      if (r.tipo === "Receita") b.receita += v;
      else if (r.tipo === "Despesa") b.despesa += v;
    }
    return Array.from(buckets.entries()).map(([key, v]) => {
      const [y, m] = key.split("-").map(Number);
      return {
        mes: `${MESES_PT[m - 1]}/${String(y).slice(2)}`,
        receita: Math.round(v.receita),
        despesa: Math.round(v.despesa),
        lucro: Math.round(v.receita - v.despesa),
      };
    });
  }, [evol12mQ.data]);

  const loading = atualQ.isLoading || antQ.isLoading;
  const labelPeriodo = useMemo(() => {
    const base = PERIODOS_BASE.find((p) => p.key === periodoKey);
    if (base) return base.label;
    if (typeof periodoKey === "string" && periodoKey.startsWith("ano_"))
      return `Ano ${periodoKey.slice(4)}`;
    if (periodoKey === "personalizado")
      return `${customStart} → ${customEnd}`;
    return "";
  }, [periodoKey, customStart, customEnd]);

  return (
    <PageShell
      title="Análise"
      description="Consolidado financeiro do Grupo BJ7 (views DRE)"
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={periodoKey}
            onValueChange={(v) => setPeriodoKey(v as PeriodoKey)}
          >
            <SelectTrigger className="w-[200px] h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PERIODOS_BASE.map((p) => (
                <SelectItem key={p.key} value={p.key}>
                  {p.label}
                </SelectItem>
              ))}
              <SelectSeparator />
              {anos.map((y) => (
                <SelectItem key={y} value={`ano_${y}`}>
                  Ano {y}
                </SelectItem>
              ))}
              <SelectSeparator />
              <SelectItem value="personalizado">Personalizado…</SelectItem>
            </SelectContent>
          </Select>
          {periodoKey === "personalizado" && (
            <div className="flex items-center gap-1">
              <Input
                type="date"
                value={customStart}
                min={`${MIN_YEAR}-01-01`}
                max={customEnd || hojeISO}
                onChange={(e) => setCustomStart(e.target.value)}
                className="h-9 w-[150px]"
              />
              <span className="text-muted-foreground text-xs">→</span>
              <Input
                type="date"
                value={customEnd}
                min={customStart || `${MIN_YEAR}-01-01`}
                max={hojeISO}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="h-9 w-[150px]"
              />
            </div>
          )}
        </div>
      }
    >
      {atualQ.error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 text-destructive text-sm p-3">
          Erro carregando DRE: {(atualQ.error as Error).message}
        </div>
      )}

      <section>
        <SectionHeader title="Consolidado do grupo" description={labelPeriodo} />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <KpiCard
            label="Receita"
            value={formatBRL(consolidado.rec)}
            trend={consolidado.trendRec}
            hint={skipComparison ? "Janela longa demais para comparar" : "vs período anterior"}
            icon={<TrendingUp className="h-4 w-4" />}
            status="neutral"
          />
          <KpiCard
            label="Despesa"
            value={formatBRL(consolidado.desp)}
            trend={consolidado.trendDesp}
            hint={skipComparison ? "Janela longa demais para comparar" : "vs período anterior"}
            icon={<TrendingDown className="h-4 w-4" />}
            status={
              consolidado.trendDesp != null && consolidado.trendDesp > 0.1
                ? "atencao"
                : "neutral"
            }
          />
          <KpiCard
            label="Lucro"
            value={formatBRL(consolidado.lucro)}
            trend={consolidado.trendLucro}
            hint={skipComparison ? "Janela longa demais para comparar" : "vs período anterior"}
            icon={<PiggyBank className="h-4 w-4" />}
            status={consolidado.lucro < 0 ? "critico" : "ok"}
          />
          <KpiCard
            label="Margem"
            value={consolidado.rec > 0 ? `${consolidado.margem.toFixed(1)}%` : "—"}
            hint={
              skipComparison
                ? "Janela longa, sem comparação"
                : consolidado.rec > 0 && consolidado.trendMargemPp != null
                  ? `${consolidado.trendMargemPp >= 0 ? "+" : ""}${consolidado.trendMargemPp.toFixed(1)} pp vs anterior`
                  : undefined
            }
            icon={<Percent className="h-4 w-4" />}
            status={
              consolidado.margem < 0
                ? "critico"
                : consolidado.margem < 10
                  ? "atencao"
                  : "ok"
            }
          />
        </div>
      </section>

      <section>
        <SectionHeader title="Por empresa" description="Desempenho no período" />
        <div
          className="rounded-2xl bg-card ring-1 ring-white/5 overflow-hidden"
          style={{ boxShadow: "var(--shadow-elegant)" }}
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Empresa</TableHead>
                <TableHead className="text-right">Receita</TableHead>
                <TableHead className="text-right">Despesa</TableHead>
                <TableHead className="text-right">Lucro</TableHead>
                <TableHead className="text-right">Margem</TableHead>
                <TableHead className="text-right">vs anterior</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    Carregando...
                  </TableCell>
                </TableRow>
              )}
              {!loading && porEmpresa.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    Nenhum lançamento no período.
                  </TableCell>
                </TableRow>
              )}
              {porEmpresa.map((e) => {
                const margemCor =
                  e.margem < 0
                    ? "text-destructive"
                    : e.margem < 10
                      ? "text-warning"
                      : "text-success";
                const deltaCor =
                  e.deltaMargemPp > 0.5
                    ? "text-success"
                    : e.deltaMargemPp < -0.5
                      ? "text-destructive"
                      : "text-muted-foreground";
                return (
                  <TableRow key={e.empresa_id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="font-medium">{e.nome}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right tabular">{formatBRL(e.rec)}</TableCell>
                    <TableCell className="text-right tabular">{formatBRL(e.desp)}</TableCell>
                    <TableCell
                      className={`text-right tabular font-medium ${e.lucro < 0 ? "text-destructive" : "text-success"}`}
                    >
                      {formatBRL(e.lucro)}
                    </TableCell>
                    <TableCell className={`text-right tabular ${margemCor}`}>
                      {e.rec > 0 ? `${e.margem.toFixed(1)}%` : "—"}
                    </TableCell>
                    <TableCell className={`text-right tabular ${deltaCor}`}>
                      {e.rec > 0 && e.margemAnt > 0
                        ? `${e.deltaMargemPp >= 0 ? "+" : ""}${e.deltaMargemPp.toFixed(1)} pp`
                        : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button asChild variant="ghost" size="sm" className="h-7 px-2">
                        <Link to="/empresas/$id" params={{ id: String(e.empresa_id) }}>
                          <ArrowRight className="h-3.5 w-3.5" />
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
              {porEmpresa.length > 0 && (
                <TableRow className="border-t border-white/10 bg-muted/20 font-semibold">
                  <TableCell>TOTAL</TableCell>
                  <TableCell className="text-right tabular">{formatBRL(consolidado.rec)}</TableCell>
                  <TableCell className="text-right tabular">{formatBRL(consolidado.desp)}</TableCell>
                  <TableCell
                    className={`text-right tabular ${consolidado.lucro < 0 ? "text-destructive" : "text-success"}`}
                  >
                    {formatBRL(consolidado.lucro)}
                  </TableCell>
                  <TableCell className="text-right tabular">
                    {consolidado.rec > 0 ? `${consolidado.margem.toFixed(1)}%` : "—"}
                  </TableCell>
                  <TableCell />
                  <TableCell />
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </section>

      <section>
        <SectionHeader
          title="Evolução — últimos 12 meses"
          description="Receita, despesa e lucro consolidados (DRE)"
        />
        <div
          className="rounded-2xl bg-card ring-1 ring-white/5 p-4"
          style={{ boxShadow: "var(--shadow-elegant)" }}
        >
          <div className="h-[320px] w-full">
            {evol12mQ.isLoading ? (
              <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
                Carregando…
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={evolucao} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                  <XAxis
                    dataKey="mes"
                    tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) =>
                      new Intl.NumberFormat("pt-BR", {
                        notation: "compact",
                        maximumFractionDigits: 1,
                      }).format(v as number)
                    }
                  />
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--popover))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 8,
                      fontSize: 12,
                      color: "hsl(var(--popover-foreground))",
                    }}
                    labelStyle={{ color: "hsl(var(--popover-foreground))", fontWeight: 600 }}
                    itemStyle={{ color: "hsl(var(--popover-foreground))" }}
                    formatter={(value: number) => formatBRL(value)}
                  />
                  <Legend wrapperStyle={{ fontSize: 12, color: "hsl(var(--foreground))" }} />
                  <Line type="monotone" dataKey="receita" name="Receita" stroke="hsl(142 71% 55%)" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="despesa" name="Despesa" stroke="hsl(0 84% 65%)" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="lucro" name="Lucro" stroke="hsl(217 91% 65%)" strokeWidth={2.5} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </section>
    </PageShell>
  );
}
