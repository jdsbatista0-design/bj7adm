import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresas, useCategorias } from "@/hooks/use-refs";
import type {
  DreConsolidadaRow,
  DreOperacionalRow,
  LancamentoRow,
} from "@/integrations/supabase/database";
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
import { formatBRL, MESES_PT, toLocalIsoDate, formatDate } from "@/lib/format";
import { TrendingUp, TrendingDown, Wallet, Percent } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

export function RelatoriosView() {
  return <RelatoriosBI />;
}

const MIN_YEAR = 2018;
const STALE = 5 * 60 * 1000;

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

type PeriodoKey =
  | "todos"
  | "ult_12m"
  | "ult_6m"
  | "ult_3m"
  | "ano_atual"
  | `ano_${number}`;

type DrillSpec =
  | { kind: "categoria"; nome: string; label: string }
  | { kind: "grupo"; nome: string; label: string }
  | {
      kind: "empresa";
      id: number;
      label: string;
      metric?: "receita" | "despesa" | "lucro";
    }
  | { kind: "tipo"; nome: string; label: string }
  | {
      kind: "mes";
      mesKey: string;
      label: string;
      metric?: "receita" | "despesa" | "lucro";
    };

function rangeFor(p: PeriodoKey): { start: string | null; end: string | null } {
  const hoje = new Date();
  const y = hoje.getFullYear();
  const m = hoje.getMonth();
  if (p === "todos") return { start: null, end: null };
  if (p === "ult_3m")
    return {
      start: toLocalIsoDate(new Date(y, m - 2, 1)),
      end: toLocalIsoDate(new Date(y, m + 1, 1)),
    };
  if (p === "ult_6m")
    return {
      start: toLocalIsoDate(new Date(y, m - 5, 1)),
      end: toLocalIsoDate(new Date(y, m + 1, 1)),
    };
  if (p === "ult_12m")
    return {
      start: toLocalIsoDate(new Date(y, m - 11, 1)),
      end: toLocalIsoDate(new Date(y, m + 1, 1)),
    };
  if (p === "ano_atual")
    return {
      start: toLocalIsoDate(new Date(y, 0, 1)),
      end: toLocalIsoDate(new Date(y + 1, 0, 1)),
    };
  if (p.startsWith("ano_")) {
    const year = Number(p.split("_")[1]);
    return {
      start: toLocalIsoDate(new Date(year, 0, 1)),
      end: toLocalIsoDate(new Date(year + 1, 0, 1)),
    };
  }
  return { start: null, end: null };
}

function RelatoriosBI() {
  const empresas = useEmpresas();
  const categorias = useCategorias();

  const [periodo, setPeriodo] = useState<PeriodoKey>("ult_12m");
  const [empresaId, setEmpresaId] = useState<string>("all");
  const [drill, setDrill] = useState<DrillSpec | null>(null);

  const range = useMemo(() => rangeFor(periodo), [periodo]);

  // ===== Q1: dre_consolidada → KPIs / meses / grupos / tipos / empresas =====
  const consQ = useQuery({
    queryKey: ["relatorios", "cons", range.start, range.end, empresaId],
    staleTime: STALE,
    gcTime: 10 * 60 * 1000,
    placeholderData: (prev) => prev,
    queryFn: async () => {
      let q = supabase
        .from("dre_consolidada")
        .select("empresa_id,mes_ref,tipo,grupo,valor_total")
        .eq("entra_dre", true);
      if (range.start) q = q.gte("mes_ref", range.start);
      if (range.end) q = q.lt("mes_ref", range.end);
      if (empresaId !== "all") q = q.eq("empresa_id", Number(empresaId));
      const r = await q;
      if (r.error) throw r.error;
      return (r.data ?? []) as DreConsolidadaRow[];
    },
  });

  // ===== Q2: dre_operacional → categoria-level (top categorias + pivot) =====
  const opQ = useQuery({
    queryKey: ["relatorios", "op", range.start, range.end, empresaId],
    staleTime: STALE,
    gcTime: 10 * 60 * 1000,
    placeholderData: (prev) => prev,
    queryFn: async () => {
      let q = supabase
        .from("dre_operacional")
        .select("empresa_id,ano,mes_ref,grupo,categoria,valor_total");
      if (range.start) q = q.gte("mes_ref", range.start);
      if (range.end) q = q.lt("mes_ref", range.end);
      if (empresaId !== "all") q = q.eq("empresa_id", Number(empresaId));
      const r = await q;
      if (r.error) throw r.error;
      return (r.data ?? []) as DreOperacionalRow[];
    },
  });

  const empresaNomeById = useMemo(() => {
    const m = new Map<number, string>();
    (empresas.data ?? []).forEach((e) => m.set(e.id, e.nome));
    return m;
  }, [empresas.data]);

  // ===== Aggregations from dre_consolidada =====
  const dados = useMemo(() => {
    const rows = consQ.data ?? [];
    let receita = 0;
    let despesa = 0;
    const porMesMap = new Map<string, { receita: number; despesa: number }>();
    const porEmpMap = new Map<number, { receita: number; despesa: number }>();
    const porGrupoMap = new Map<string, number>();
    const porTipoMap = new Map<string, number>();

    for (const r of rows) {
      const v = Math.abs(Number(r.valor_total) || 0);
      const tipo = r.tipo;
      porTipoMap.set(tipo, (porTipoMap.get(tipo) ?? 0) + v);

      const mesKey = (r.mes_ref ?? "").slice(0, 7);
      const mes = porMesMap.get(mesKey) ?? { receita: 0, despesa: 0 };
      const emp = porEmpMap.get(r.empresa_id) ?? { receita: 0, despesa: 0 };

      if (tipo === "Receita") {
        receita += v;
        mes.receita += v;
        emp.receita += v;
      } else if (tipo === "Despesa" || tipo === "Retirada") {
        despesa += v;
        mes.despesa += v;
        emp.despesa += v;
      }
      porMesMap.set(mesKey, mes);
      porEmpMap.set(r.empresa_id, emp);

      const gNome = r.grupo ?? "Sem grupo";
      porGrupoMap.set(gNome, (porGrupoMap.get(gNome) ?? 0) + v);
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
        return {
          mes: label,
          mesKey: k,
          receita: v.receita,
          despesa: v.despesa,
          lucro: v.receita - v.despesa,
        };
      });

    const topEmpresas = Array.from(porEmpMap.entries())
      .map(([id, v]) => ({
        id,
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
      topEmpresas,
      porGrupo,
      porTipo,
    };
  }, [consQ.data, empresaNomeById]);

  // ===== Top categorias + pivot from dre_operacional =====
  const catData = useMemo(() => {
    const rows = opQ.data ?? [];
    const porCatTotal = new Map<string, number>();
    const anosSet = new Set<number>();
    const byCat = new Map<
      string,
      { grupo: string; perYear: Map<number, number>; total: number }
    >();

    for (const r of rows) {
      const nome = r.categoria ?? "(sem categoria)";
      const v = Math.abs(Number(r.valor_total) || 0);
      const ano = r.ano;
      if (ano) anosSet.add(ano);

      porCatTotal.set(nome, (porCatTotal.get(nome) ?? 0) + v);

      let entry = byCat.get(nome);
      if (!entry) {
        entry = {
          grupo: r.grupo ?? "—",
          perYear: new Map(),
          total: 0,
        };
        byCat.set(nome, entry);
      }
      if (ano) entry.perYear.set(ano, (entry.perYear.get(ano) ?? 0) + v);
      entry.total += v;
    }

    const topCategorias = Array.from(porCatTotal.entries())
      .map(([nome, total]) => ({ nome, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);

    const anos = Array.from(anosSet).sort((a, b) => a - b);
    const linhas = Array.from(byCat.entries())
      .map(([nome, e]) => ({
        nome,
        grupo: e.grupo,
        perYear: e.perYear,
        total: e.total,
      }))
      .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));

    const totaisAno = new Map<number, number>();
    let totalGeral = 0;
    for (const l of linhas) {
      totalGeral += l.total;
      for (const a of anos) {
        totaisAno.set(a, (totaisAno.get(a) ?? 0) + (l.perYear.get(a) ?? 0));
      }
    }
    return { topCategorias, anos, linhas, totaisAno, totalGeral };
  }, [opQ.data]);

  // ===== Drill: lazy query lancamentos when drill opens =====
  const drillQ = useQuery({
    queryKey: ["relatorios", "drill", drill, range.start, range.end, empresaId],
    enabled: !!drill,
    staleTime: 60_000,
    queryFn: async () => {
      let q = supabase
        .from("lancamentos")
        .select(
          "id,data,empresa_id,categoria_id,tipo,descricao,subcategoria,valor",
        )
        .eq("contar_no_total", true)
        .order("data", { ascending: false })
        .limit(2000);
      if (range.start) q = q.gte("data", range.start);
      if (range.end) q = q.lt("data", range.end);
      if (empresaId !== "all") q = q.eq("empresa_id", Number(empresaId));

      if (drill?.kind === "categoria") {
        const cat = (categorias.data ?? []).find((c) => c.nome === drill.nome);
        if (!cat) return [] as LancamentoRow[];
        q = q.eq("categoria_id", cat.id);
      } else if (drill?.kind === "grupo") {
        const catIds = (categorias.data ?? [])
          .filter((c) => (c.grupo ?? "Sem grupo") === drill.nome)
          .map((c) => c.id);
        if (catIds.length === 0) return [] as LancamentoRow[];
        q = q.in("categoria_id", catIds);
      } else if (drill?.kind === "tipo") {
        q = q.eq("tipo", drill.nome);
      } else if (drill?.kind === "empresa") {
        q = q.eq("empresa_id", drill.id);
        if (drill.metric === "receita") q = q.eq("tipo", "Receita");
        else if (drill.metric === "despesa")
          q = q.in("tipo", ["Despesa", "Retirada"]);
      } else if (drill?.kind === "mes") {
        const [y, m] = drill.mesKey.split("-").map(Number);
        const start = toLocalIsoDate(new Date(y, m - 1, 1));
        const end = toLocalIsoDate(new Date(y, m, 1));
        q = q.gte("data", start).lt("data", end);
        if (drill.metric === "receita") q = q.eq("tipo", "Receita");
        else if (drill.metric === "despesa")
          q = q.in("tipo", ["Despesa", "Retirada"]);
      }
      const r = await q;
      if (r.error) throw r.error;
      return (r.data ?? []) as LancamentoRow[];
    },
  });

  const categoriaById = useMemo(() => {
    const m = new Map<number, string>();
    (categorias.data ?? []).forEach((c) => m.set(c.id, c.nome));
    return m;
  }, [categorias.data]);

  const drillData = useMemo(() => {
    if (!drill || !drillQ.data) return null;
    const filtered = drillQ.data;
    const total = filtered.reduce(
      (s, r) => s + Math.abs(Number(r.valor) || 0),
      0,
    );

    const porDesc = new Map<string, { total: number; qtd: number }>();
    const porEmp = new Map<number, { total: number; qtd: number }>();
    const porCat = new Map<number, { total: number; qtd: number }>();
    for (const r of filtered) {
      const v = Math.abs(Number(r.valor) || 0);
      const key =
        r.descricao?.trim() || r.subcategoria?.trim() || "(sem descrição)";
      const d = porDesc.get(key) ?? { total: 0, qtd: 0 };
      d.total += v;
      d.qtd += 1;
      porDesc.set(key, d);
      const e = porEmp.get(r.empresa_id) ?? { total: 0, qtd: 0 };
      e.total += v;
      e.qtd += 1;
      porEmp.set(r.empresa_id, e);
      if (r.categoria_id) {
        const c = porCat.get(r.categoria_id) ?? { total: 0, qtd: 0 };
        c.total += v;
        c.qtd += 1;
        porCat.set(r.categoria_id, c);
      }
    }

    return {
      total,
      qtd: filtered.length,
      breakdownDesc: Array.from(porDesc.entries())
        .map(([nome, v]) => ({ nome, ...v }))
        .sort((a, b) => b.total - a.total),
      breakdownEmp: Array.from(porEmp.entries())
        .map(([id, v]) => ({
          nome: empresaNomeById.get(id) ?? `#${id}`,
          ...v,
        }))
        .sort((a, b) => b.total - a.total),
      breakdownCat: Array.from(porCat.entries())
        .map(([id, v]) => ({ nome: categoriaById.get(id) ?? `#${id}`, ...v }))
        .sort((a, b) => b.total - a.total),
      recentes: filtered.slice(0, 50),
    };
  }, [drill, drillQ.data, empresaNomeById, categoriaById]);

  const isLoading = consQ.isLoading || opQ.isLoading;
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
      <div
        className="rounded-2xl bg-card p-3 ring-1 ring-border mb-6 flex flex-wrap items-center gap-2"
        style={{ boxShadow: "var(--shadow-elegant)" }}
      >
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
          {isLoading
            ? "Carregando…"
            : `${dados.qtd.toLocaleString("pt-BR")} buckets agregados`}
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
          value={
            dados.margem === null ? "—" : `${(dados.margem * 100).toFixed(1)}%`
          }
          icon={<Percent className="h-4 w-4" />}
          status={
            dados.margem === null
              ? "neutral"
              : dados.margem >= 0.15
                ? "ok"
                : dados.margem >= 0
                  ? "atencao"
                  : "critico"
          }
        />
      </div>

      {/* Evolução mensal */}
      <section className="mb-6">
        <SectionHeader
          title="Evolução mensal"
          description="Receita, despesa e lucro mês a mês"
        />
        <div
          className="rounded-2xl bg-card p-4 ring-1 ring-border"
          style={{ boxShadow: "var(--shadow-elegant)" }}
        >
          <div className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={dados.meses}
                margin={{ top: 8, right: 16, left: 0, bottom: 0 }}
              >
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
                <Line
                  type="monotone"
                  dataKey="receita"
                  name="Receita"
                  stroke={COLORS.receita}
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="despesa"
                  name="Despesa"
                  stroke={COLORS.despesa}
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="lucro"
                  name="Lucro"
                  stroke={COLORS.lucro}
                  strokeWidth={2.5}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-3 mb-6">
        <section className="lg:col-span-2">
          <SectionHeader
            title="Top 10 categorias"
            description="Volume operacional no período"
          />
          <div
            className="rounded-2xl bg-card p-4 ring-1 ring-border"
            style={{ boxShadow: "var(--shadow-elegant)" }}
          >
            <div className="h-[360px]">
              {opQ.isLoading ? (
                <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
                  Carregando…
                </div>
              ) : catData.topCategorias.length === 0 ? (
                <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
                  Sem dados no período.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={catData.topCategorias}
                    layout="vertical"
                    margin={{ top: 4, right: 16, left: 0, bottom: 0 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="#e5e7eb"
                      opacity={0.4}
                      horizontal={false}
                    />
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
                      formatter={(v: number) => formatBRL(v)}
                    />
                    <Bar
                      dataKey="total"
                      name="Total"
                      fill={COLORS.primary}
                      radius={[0, 6, 6, 0]}
                      cursor="pointer"
                      onClick={(d: { nome?: string }) => {
                        if (d?.nome)
                          setDrill({
                            kind: "categoria",
                            nome: d.nome,
                            label: d.nome,
                          });
                      }}
                    />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </section>

        <section>
          <SectionHeader title="Mix por tipo" description="Distribuição do volume" />
          <div
            className="rounded-2xl bg-card p-4 ring-1 ring-border"
            style={{ boxShadow: "var(--shadow-elegant)" }}
          >
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
                    cursor="pointer"
                    onClick={(d: { name?: string; nome?: string }) => {
                      const nome = d?.name ?? d?.nome;
                      if (nome) setDrill({ kind: "tipo", nome, label: nome });
                    }}
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
        <div
          className="rounded-2xl bg-card p-4 ring-1 ring-border"
          style={{ boxShadow: "var(--shadow-elegant)" }}
        >
          <div className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={dados.topEmpresas}
                margin={{ top: 4, right: 16, left: 0, bottom: 0 }}
              >
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
                  formatter={(v: number) => formatBRL(v)}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar
                  dataKey="receita"
                  name="Receita"
                  fill={COLORS.receita}
                  radius={[4, 4, 0, 0]}
                  cursor="pointer"
                  onClick={(d: { nome?: string }) => {
                    const found = (empresas.data ?? []).find(
                      (e) => e.nome === d?.nome,
                    );
                    if (found)
                      setDrill({
                        kind: "empresa",
                        id: found.id,
                        label: `${found.nome} — Receita`,
                        metric: "receita",
                      });
                  }}
                />
                <Bar
                  dataKey="despesa"
                  name="Despesa"
                  fill={COLORS.despesa}
                  radius={[4, 4, 0, 0]}
                  cursor="pointer"
                  onClick={(d: { nome?: string }) => {
                    const found = (empresas.data ?? []).find(
                      (e) => e.nome === d?.nome,
                    );
                    if (found)
                      setDrill({
                        kind: "empresa",
                        id: found.id,
                        label: `${found.nome} — Despesa`,
                        metric: "despesa",
                      });
                  }}
                />
                <Bar
                  dataKey="lucro"
                  name="Lucro"
                  fill={COLORS.lucro}
                  radius={[4, 4, 0, 0]}
                  cursor="pointer"
                  onClick={(d: { nome?: string }) => {
                    const found = (empresas.data ?? []).find(
                      (e) => e.nome === d?.nome,
                    );
                    if (found)
                      setDrill({
                        kind: "empresa",
                        id: found.id,
                        label: `${found.nome}`,
                        metric: "lucro",
                      });
                  }}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      {/* Resumo por grupo */}
      <section className="mb-6">
        <SectionHeader
          title="Resumo por grupo de categoria"
          description="Volume agregado e participação"
        />
        <div
          className="rounded-2xl bg-card ring-1 ring-border overflow-hidden"
          style={{ boxShadow: "var(--shadow-elegant)" }}
        >
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
                  <TableCell
                    colSpan={3}
                    className="text-center text-sm text-muted-foreground py-6"
                  >
                    Sem dados no período.
                  </TableCell>
                </TableRow>
              )}
              {dados.porGrupo.map((g) => {
                const total = dados.porGrupo.reduce((a, b) => a + b.total, 0);
                const pct = total > 0 ? (g.total / total) * 100 : 0;
                return (
                  <TableRow
                    key={g.nome}
                    className="cursor-pointer hover:bg-accent/50"
                    onClick={() =>
                      setDrill({
                        kind: "grupo",
                        nome: g.nome,
                        label: `Grupo: ${g.nome}`,
                      })
                    }
                  >
                    <TableCell className="font-medium">{g.nome}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatBRL(g.total)}
                    </TableCell>
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

      {/* Pivô Categoria × Ano */}
      <section className="mb-6">
        <SectionHeader
          title="Categorias por ano"
          description="Volume movimentado por categoria operacional e ano (clique para detalhar)"
        />
        <div
          className="rounded-2xl bg-card ring-1 ring-border overflow-x-auto"
          style={{ boxShadow: "var(--shadow-elegant)" }}
        >
          <Table>
            <TableHeader>
              <TableRow className="bg-primary/5">
                <TableHead className="sticky left-0 bg-card z-10 min-w-[180px]">
                  Categoria
                </TableHead>
                <TableHead className="min-w-[140px]">Grupo</TableHead>
                {catData.anos.map((a) => (
                  <TableHead
                    key={a}
                    className="text-right tabular-nums min-w-[110px]"
                  >
                    {a}
                  </TableHead>
                ))}
                <TableHead className="text-right tabular-nums min-w-[130px] font-bold">
                  TOTAL
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {catData.linhas.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={catData.anos.length + 3}
                    className="text-center text-sm text-muted-foreground py-6"
                  >
                    Sem dados no período.
                  </TableCell>
                </TableRow>
              )}
              {catData.linhas.map((l) => (
                <TableRow
                  key={l.nome}
                  className="cursor-pointer hover:bg-accent/50"
                  onClick={() =>
                    setDrill({ kind: "categoria", nome: l.nome, label: l.nome })
                  }
                >
                  <TableCell className="font-medium sticky left-0 bg-card z-10">
                    {l.nome}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {l.grupo}
                  </TableCell>
                  {catData.anos.map((a) => {
                    const v = l.perYear.get(a) ?? 0;
                    return (
                      <TableCell
                        key={a}
                        className="text-right tabular-nums text-xs"
                      >
                        {v === 0 ? (
                          <span className="text-muted-foreground">—</span>
                        ) : (
                          formatBRL(v)
                        )}
                      </TableCell>
                    );
                  })}
                  <TableCell className="text-right tabular-nums font-semibold bg-primary/5">
                    {formatBRL(l.total)}
                  </TableCell>
                </TableRow>
              ))}
              {catData.linhas.length > 0 && (
                <TableRow className="bg-muted/50 font-bold">
                  <TableCell className="sticky left-0 bg-muted/80 z-10">
                    TOTAL
                  </TableCell>
                  <TableCell />
                  {catData.anos.map((a) => (
                    <TableCell
                      key={a}
                      className="text-right tabular-nums text-xs"
                    >
                      {formatBRL(catData.totaisAno.get(a) ?? 0)}
                    </TableCell>
                  ))}
                  <TableCell className="text-right tabular-nums bg-primary/10">
                    {formatBRL(catData.totalGeral)}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </section>

      <Dialog open={!!drill} onOpenChange={(o) => !o && setDrill(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detalhamento: {drill?.label}</DialogTitle>
            <DialogDescription>
              {drillQ.isLoading
                ? "Carregando…"
                : drillData
                  ? `${drillData.qtd.toLocaleString("pt-BR")} lançamentos · ${formatBRL(drillData.total)}`
                  : "Sem dados"}
            </DialogDescription>
          </DialogHeader>

          {drillData && (
            <div className="space-y-5">
              {drillData.breakdownDesc.length > 1 && (
                <div>
                  <div className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">
                    Por descrição
                  </div>
                  <div className="rounded-lg ring-1 ring-border overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Descrição</TableHead>
                          <TableHead className="text-right w-[80px]">Qtd</TableHead>
                          <TableHead className="text-right w-[140px]">
                            Total
                          </TableHead>
                          <TableHead className="text-right w-[80px]">%</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {drillData.breakdownDesc.slice(0, 20).map((b) => (
                          <TableRow key={b.nome}>
                            <TableCell className="font-medium">{b.nome}</TableCell>
                            <TableCell className="text-right tabular-nums">
                              {b.qtd}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {formatBRL(b.total)}
                            </TableCell>
                            <TableCell className="text-right tabular-nums text-muted-foreground">
                              {drillData.total > 0
                                ? ((b.total / drillData.total) * 100).toFixed(1)
                                : "0"}
                              %
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}

              {drill?.kind !== "empresa" && drillData.breakdownEmp.length > 1 && (
                <div>
                  <div className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">
                    Por empresa
                  </div>
                  <div className="rounded-lg ring-1 ring-border overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Empresa</TableHead>
                          <TableHead className="text-right w-[80px]">Qtd</TableHead>
                          <TableHead className="text-right w-[140px]">
                            Total
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {drillData.breakdownEmp.map((b) => (
                          <TableRow key={b.nome}>
                            <TableCell className="font-medium">{b.nome}</TableCell>
                            <TableCell className="text-right tabular-nums">
                              {b.qtd}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {formatBRL(b.total)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}

              {(drill?.kind === "grupo" ||
                drill?.kind === "tipo" ||
                drill?.kind === "empresa") &&
                drillData.breakdownCat.length > 1 && (
                  <div>
                    <div className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">
                      Por categoria
                    </div>
                    <div className="rounded-lg ring-1 ring-border overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Categoria</TableHead>
                            <TableHead className="text-right w-[80px]">
                              Qtd
                            </TableHead>
                            <TableHead className="text-right w-[140px]">
                              Total
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {drillData.breakdownCat.slice(0, 20).map((b) => (
                            <TableRow key={b.nome}>
                              <TableCell className="font-medium">
                                {b.nome}
                              </TableCell>
                              <TableCell className="text-right tabular-nums">
                                {b.qtd}
                              </TableCell>
                              <TableCell className="text-right tabular-nums">
                                {formatBRL(b.total)}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}

              <div>
                <div className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">
                  Lançamentos recentes (até 50)
                </div>
                <div className="rounded-lg ring-1 ring-border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[100px]">Data</TableHead>
                        <TableHead>Descrição</TableHead>
                        <TableHead>Empresa</TableHead>
                        <TableHead className="text-right w-[120px]">
                          Valor
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {drillData.recentes.map((r) => (
                        <TableRow key={r.id}>
                          <TableCell className="tabular-nums text-xs">
                            {formatDate(r.data)}
                          </TableCell>
                          <TableCell
                            className="text-xs max-w-[280px] truncate"
                            title={r.descricao ?? ""}
                          >
                            {r.descricao ?? r.subcategoria ?? "—"}
                          </TableCell>
                          <TableCell className="text-xs">
                            {empresaNomeById.get(r.empresa_id) ?? `#${r.empresa_id}`}
                          </TableCell>
                          <TableCell className="text-right tabular-nums text-xs">
                            {formatBRL(Number(r.valor))}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}
