import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { paginateAll } from "@/integrations/supabase/db";
import { useEmpresas, useCategorias } from "@/hooks/use-refs";
import type { LancamentoRow } from "@/integrations/supabase/database";
import { PageShell, SectionHeader } from "@/components/bj7/PageShell";
import { KpiCard } from "@/components/bj7/KpiCard";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
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
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";
import { formatBRL, MESES_PT, toLocalIsoDate } from "@/lib/format";
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  Percent,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/relatorios")({
  component: RelatoriosBI,
});

const MIN_YEAR = 2018;

const COLORS = {
  receita: "hsl(142 71% 45%)",
  despesa: "hsl(0 84% 60%)",
  lucro: "hsl(217 91% 55%)",
  primary: "hsl(245 70% 55%)",
};

const PIE_COLORS = [
  "hsl(245 70% 55%)",
  "hsl(142 71% 45%)",
  "hsl(0 84% 60%)",
  "hsl(38 92% 50%)",
  "hsl(199 89% 48%)",
  "hsl(280 65% 60%)",
  "hsl(160 60% 45%)",
  "hsl(20 90% 55%)",
];

function anosDisponiveis(): number[] {
  const atual = new Date().getFullYear();
  const out: number[] = [];
  for (let y = atual; y >= MIN_YEAR; y--) out.push(y);
  return out;
}

type PeriodoKey = "todos" | "ult_12m" | "ult_6m" | "ult_3m" | "ano_atual" | `ano_${number}`;

function rangeFor(p: PeriodoKey): { start: string | null; end: string | null } {
  const hoje = new Date();
  const y = hoje.getFullYear();
  const m = hoje.getMonth();
  if (p === "todos") return { start: null, end: null };
  if (p === "ult_3m")
    return { start: toLocalIsoDate(new Date(y, m - 2, 1)), end: toLocalIsoDate(new Date(y, m + 1, 1)) };
  if (p === "ult_6m")
    return { start: toLocalIsoDate(new Date(y, m - 5, 1)), end: toLocalIsoDate(new Date(y, m + 1, 1)) };
  if (p === "ult_12m")
    return { start: toLocalIsoDate(new Date(y, m - 11, 1)), end: toLocalIsoDate(new Date(y, m + 1, 1)) };
  if (p === "ano_atual")
    return { start: toLocalIsoDate(new Date(y, 0, 1)), end: toLocalIsoDate(new Date(y + 1, 0, 1)) };
  if (p.startsWith("ano_")) {
    const year = Number(p.split("_")[1]);
    return { start: toLocalIsoDate(new Date(year, 0, 1)), end: toLocalIsoDate(new Date(year + 1, 0, 1)) };
  }
  return { start: null, end: null };
}

function RelatoriosBI() {
  const empresas = useEmpresas();
  const categorias = useCategorias();

  const [periodo, setPeriodo] = useState<PeriodoKey>("ult_12m");
  const [empresaId, setEmpresaId] = useState<string>("all");

  const range = useMemo(() => rangeFor(periodo), [periodo]);

  const lancQ = useQuery({
    queryKey: ["relatorios", "lanc", range.start, range.end, empresaId],
    queryFn: async () => {
      return await paginateAll<LancamentoRow>((fromIdx, toIdx) => {
        let q = supabase
          .from("lancamentos")
          .select(
            "id,data,ano,mes,empresa_id,categoria_id,tipo,valor,contar_no_total",
          )
          .eq("contar_no_total", true)
          .order("data", { ascending: true })
          .range(fromIdx, toIdx);
        if (range.start) q = q.gte("data", range.start);
        if (range.end) q = q.lt("data", range.end);
        if (empresaId !== "all") q = q.eq("empresa_id", Number(empresaId));
        return q;
      });
    },
    staleTime: 60_000,
  });

  const empresaNomeById = useMemo(() => {
    const m = new Map<number, string>();
    (empresas.data ?? []).forEach((e) => m.set(e.id, e.nome));
    return m;
  }, [empresas.data]);

  const categoriaById = useMemo(() => {
    const m = new Map<number, { nome: string; grupo: string | null }>();
    (categorias.data ?? []).forEach((c) =>
      m.set(c.id, { nome: c.nome, grupo: c.grupo }),
    );
    return m;
  }, [categorias.data]);

  const dados = useMemo(() => {
    const rows = lancQ.data ?? [];
    let receita = 0;
    let despesa = 0;
    const porMesMap = new Map<string, { receita: number; despesa: number }>();
    const porCatMap = new Map<number, number>();
    const porEmpMap = new Map<number, { receita: number; despesa: number }>();
    const porGrupoMap = new Map<string, number>();
    const porTipoMap = new Map<string, number>();

    for (const r of rows) {
      const v = Number(r.valor) || 0;
      const tipo = r.tipo;
      porTipoMap.set(tipo, (porTipoMap.get(tipo) ?? 0) + Math.abs(v));

      const mesKey = (r.data ?? "").slice(0, 7);
      if (!porMesMap.has(mesKey)) porMesMap.set(mesKey, { receita: 0, despesa: 0 });
      const mes = porMesMap.get(mesKey)!;

      const empKey = r.empresa_id;
      if (!porEmpMap.has(empKey)) porEmpMap.set(empKey, { receita: 0, despesa: 0 });
      const emp = porEmpMap.get(empKey)!;

      if (tipo === "Receita") {
        receita += v;
        mes.receita += v;
        emp.receita += v;
      } else if (tipo === "Despesa" || tipo === "Retirada") {
        const abs = Math.abs(v);
        despesa += abs;
        mes.despesa += abs;
        emp.despesa += abs;
      }

      if (r.categoria_id) {
        porCatMap.set(
          r.categoria_id,
          (porCatMap.get(r.categoria_id) ?? 0) + Math.abs(v),
        );
        const cat = categoriaById.get(r.categoria_id);
        const grupo = cat?.grupo ?? "Sem grupo";
        porGrupoMap.set(grupo, (porGrupoMap.get(grupo) ?? 0) + Math.abs(v));
      }
    }

    const lucro = receita - despesa;
    const margem = receita > 0 ? lucro / receita : null;

    const meses = Array.from(porMesMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => {
        const [yy, mm] = k.split("-");
        const idx = Number(mm) - 1;
        const label =
          isFinite(idx) && idx >= 0 && idx < 12
            ? `${MESES_PT[idx]}/${yy.slice(2)}`
            : k;
        return { mes: label, receita: v.receita, despesa: v.despesa, lucro: v.receita - v.despesa };
      });

    const topCategorias = Array.from(porCatMap.entries())
      .map(([id, total]) => ({
        nome: categoriaById.get(id)?.nome ?? `#${id}`,
        total,
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);

    const topEmpresas = Array.from(porEmpMap.entries())
      .map(([id, v]) => ({
        nome: empresaNomeById.get(id) ?? `#${id}`,
        receita: v.receita,
        despesa: v.despesa,
        lucro: v.receita - v.despesa,
      }))
      .sort((a, b) => b.lucro - a.lucro);

    const porGrupo = Array.from(porGrupoMap.entries())
      .map(([nome, total]) => ({ nome, total }))
      .sort((a, b) => b.total - a.total);

    const porTipo = Array.from(porTipoMap.entries())
      .map(([nome, total]) => ({ nome, total }))
      .sort((a, b) => b.total - a.total);

    return {
      receita,
      despesa,
      lucro,
      margem,
      qtd: rows.length,
      meses,
      topCategorias,
      topEmpresas,
      porGrupo,
      porTipo,
    };
  }, [lancQ.data, categoriaById, empresaNomeById]);

  const isLoading = lancQ.isLoading || empresas.isLoading || categorias.isLoading;
  const tooltipStyle = {
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: 8,
    fontSize: 12,
    color: "#1f2937",
  };

  return (
    <PageShell
      title="Relatórios BI"
      description="Análise financeira interativa do grupo — filtre e explore"
    >
      {/* Filtros globais */}
      <div className="rounded-2xl bg-card p-3 ring-1 ring-border mb-6 flex flex-wrap items-center gap-2"
           style={{ boxShadow: "var(--shadow-elegant)" }}>
        <span className="text-xs text-muted-foreground mr-1">Filtros:</span>
        <Select value={periodo} onValueChange={(v) => setPeriodo(v as PeriodoKey)}>
          <SelectTrigger className="h-9 w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Tudo</SelectItem>
            <SelectItem value="ult_3m">Últimos 3 meses</SelectItem>
            <SelectItem value="ult_6m">Últimos 6 meses</SelectItem>
            <SelectItem value="ult_12m">Últimos 12 meses</SelectItem>
            <SelectItem value="ano_atual">Ano atual</SelectItem>
            {anosDisponiveis().map((y) => (
              <SelectItem key={y} value={`ano_${y}`}>
                Ano {y}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={empresaId} onValueChange={setEmpresaId}>
          <SelectTrigger className="h-9 w-[200px]">
            <SelectValue placeholder="Empresa" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas empresas</SelectItem>
            {(empresas.data ?? []).map((e) => (
              <SelectItem key={e.id} value={String(e.id)}>
                {e.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="ml-auto text-xs text-muted-foreground tabular-nums">
          {isLoading ? "Carregando…" : `${dados.qtd.toLocaleString("pt-BR")} lançamentos`}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4 mb-6">
        <KpiCard
          label="Receita"
          value={formatBRL(dados.receita)}
          icon={<TrendingUp className="h-4 w-4" />}
          status="ok"
        />
        <KpiCard
          label="Despesa"
          value={formatBRL(dados.despesa)}
          icon={<TrendingDown className="h-4 w-4" />}
          status="atencao"
        />
        <KpiCard
          label="Lucro"
          value={formatBRL(dados.lucro)}
          icon={<Wallet className="h-4 w-4" />}
          status={dados.lucro >= 0 ? "ok" : "critico"}
        />
        <KpiCard
          label="Margem"
          value={dados.margem === null ? "—" : `${(dados.margem * 100).toFixed(1)}%`}
          icon={<Percent className="h-4 w-4" />}
          status={dados.margem === null ? "neutral" : dados.margem >= 0.15 ? "ok" : dados.margem >= 0 ? "atencao" : "critico"}
        />
      </div>

      {/* Evolução mensal */}
      <section className="mb-6">
        <SectionHeader
          title="Evolução mensal"
          description="Receita, despesa e lucro mês a mês"
        />
        <div className="rounded-2xl bg-card p-4 ring-1 ring-border" style={{ boxShadow: "var(--shadow-elegant)" }}>
          <div className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={dados.meses} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" opacity={0.5} />
                <XAxis
                  dataKey="mes"
                  tick={{ fill: "#6b7280", fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  tick={{ fill: "#6b7280", fontSize: 11 }}
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
                  contentStyle={tooltipStyle}
                  labelStyle={{ color: "#1f2937", fontWeight: 600 }}
                  itemStyle={{ color: "#1f2937" }}
                  formatter={(v: number) => formatBRL(v)}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="receita" name="Receita" stroke={COLORS.receita} strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="despesa" name="Despesa" stroke={COLORS.despesa} strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="lucro" name="Lucro" stroke={COLORS.lucro} strokeWidth={2.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      {/* Linha dupla: Categorias + Tipos */}
      <div className="grid gap-6 lg:grid-cols-3 mb-6">
        <section className="lg:col-span-2">
          <SectionHeader title="Top 10 categorias" description="Volume movimentado no período" />
          <div className="rounded-2xl bg-card p-4 ring-1 ring-border" style={{ boxShadow: "var(--shadow-elegant)" }}>
            <div className="h-[360px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={dados.topCategorias}
                  layout="vertical"
                  margin={{ top: 4, right: 16, left: 0, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" opacity={0.4} horizontal={false} />
                  <XAxis
                    type="number"
                    tick={{ fill: "#6b7280", fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) =>
                      new Intl.NumberFormat("pt-BR", {
                        notation: "compact",
                        maximumFractionDigits: 1,
                      }).format(v as number)
                    }
                  />
                  <YAxis
                    type="category"
                    dataKey="nome"
                    width={140}
                    tick={{ fill: "#6b7280", fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    labelStyle={{ color: "#1f2937", fontWeight: 600 }}
                    itemStyle={{ color: "#1f2937" }}
                    formatter={(v: number) => formatBRL(v)}
                  />
                  <Bar dataKey="total" name="Total" fill={COLORS.primary} radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </section>

        <section>
          <SectionHeader title="Mix por tipo" description="Distribuição do volume" />
          <div className="rounded-2xl bg-card p-4 ring-1 ring-border" style={{ boxShadow: "var(--shadow-elegant)" }}>
            <div className="h-[360px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={dados.porTipo}
                    dataKey="total"
                    nameKey="nome"
                    cx="50%"
                    cy="45%"
                    outerRadius={90}
                    innerRadius={50}
                    paddingAngle={2}
                  >
                    {dados.porTipo.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={tooltipStyle}
                    formatter={(v: number) => formatBRL(v)}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </section>
      </div>

      {/* Empresas comparativo */}
      <section className="mb-6">
        <SectionHeader
          title="Performance por empresa"
          description="Receita, despesa e lucro consolidado"
        />
        <div className="rounded-2xl bg-card p-4 ring-1 ring-border" style={{ boxShadow: "var(--shadow-elegant)" }}>
          <div className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dados.topEmpresas} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" opacity={0.5} />
                <XAxis
                  dataKey="nome"
                  tick={{ fill: "#6b7280", fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  interval={0}
                  angle={-15}
                  textAnchor="end"
                  height={50}
                />
                <YAxis
                  tick={{ fill: "#6b7280", fontSize: 11 }}
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
                  contentStyle={tooltipStyle}
                  labelStyle={{ color: "#1f2937", fontWeight: 600 }}
                  itemStyle={{ color: "#1f2937" }}
                  formatter={(v: number) => formatBRL(v)}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="receita" name="Receita" fill={COLORS.receita} radius={[4, 4, 0, 0]} />
                <Bar dataKey="despesa" name="Despesa" fill={COLORS.despesa} radius={[4, 4, 0, 0]} />
                <Bar dataKey="lucro" name="Lucro" fill={COLORS.lucro} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      {/* Tabela por grupo */}
      <section className="mb-6">
        <SectionHeader title="Resumo por grupo de categoria" description="Volume agregado e participação" />
        <div className="rounded-2xl bg-card ring-1 ring-border overflow-hidden" style={{ boxShadow: "var(--shadow-elegant)" }}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Grupo</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right w-[120px]">Participação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {dados.porGrupo.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-sm text-muted-foreground py-6">
                    Sem dados no período.
                  </TableCell>
                </TableRow>
              )}
              {dados.porGrupo.map((g) => {
                const total = dados.porGrupo.reduce((a, b) => a + b.total, 0);
                const pct = total > 0 ? (g.total / total) * 100 : 0;
                return (
                  <TableRow key={g.nome}>
                    <TableCell className="font-medium">{g.nome}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatBRL(g.total)}</TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {pct.toFixed(1)}%
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </section>
    </PageShell>
  );
}
